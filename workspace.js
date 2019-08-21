const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Overview = imports.ui.overview;
const Tweener = imports.ui.tweener;
const Workspace = imports.ui.workspace;

const WindowPositionFlags = Workspace.WindowPositionFlags;

var replacedFunctions = [
    '_isMyWindow',
    '_onCloneSelected',
    '_doAddWindow',
    '_updateWindowPositions',
    'fadeToOverview',
    'fadeFromOverview',
    'zoomFromOverview'
];

var _isMyWindow = function(actor) {
    return actor.metaWindow.get_monitor() == this.monitorIndex;
};

var _onCloneSelected = function(clone, time) {
    Main.activateWindow(clone.metaWindow,
                        time,
                        clone.metaWindow.get_workspace().index());
};

var _doAddWindow = function(metaWin) {
    if (this.leavingOverview)
        return;

    let win = metaWin.get_compositor_private();

    if (!win) {
        // Newly-created windows are added to a workspace before
        // the compositor finds out about them...
        let id = Mainloop.idle_add(() => {
            // only change: made this check monitor instead of workspace
            if (this.actor &&
                metaWin.get_compositor_private() &&
                metaWin.get_monitor() == this.monitorIndex)
                this._doAddWindow(metaWin);
            return GLib.SOURCE_REMOVE;
        });
        GLib.Source.set_name_by_id(id, '[gnome-shell] this._doAddWindow');
        return;
    }

    // We might have the window in our list already if it was on all workspaces and
    // now was moved to this workspace
    if (this._lookupIndex(metaWin) != -1)
        return;

    if (!this._isMyWindow(win))
        return;

    if (!this._isOverviewWindow(win)) {
        if (metaWin.get_transient_for() == null)
            return;

        // Let the top-most ancestor handle all transients
        let parent = metaWin.find_root_ancestor();
        let clone = this._windows.find(c => c.metaWindow == parent);

        // If no clone was found, the parent hasn't been created yet
        // and will take care of the dialog when added
        if (clone)
            clone.addDialog(metaWin);

        return;
    }

    let [clone, overlay] = this._addWindowClone(win, false);

    if (win._overviewHint) {
        let x = win._overviewHint.x - this.actor.x;
        let y = win._overviewHint.y - this.actor.y;
        let scale = win._overviewHint.scale;
        delete win._overviewHint;

        clone.slot = [x, y, clone.actor.width * scale, clone.actor.height * scale];
        clone.positioned = true;

        clone.actor.set_position(x, y);
        clone.actor.set_scale(scale, scale);
        clone.overlay.relayout(false);
    }

    this._currentLayout = null;
    this._recalculateWindowPositions(WindowPositionFlags.ANIMATE);
};

var _updateWindowPositions = function(flags) {
    if (this._currentLayout == null) {
        this._recalculateWindowPositions(flags);
        return;
    }

    // We will reposition windows anyway when enter again overview or when ending the windows
    // animations whith fade animation.
    // In this way we avoid unwanted animations of windows repositioning while
    // animating overview.
    if (this.leavingOverview || this._animatingWindowsFade)
        return;

    let initialPositioning = flags & WindowPositionFlags.INITIAL;
    let animate = flags & WindowPositionFlags.ANIMATE;

    let layout = this._currentLayout;
    let strategy = layout.strategy;

    let [, , padding] = this._getSpacingAndPadding();
    let area = Workspace.padArea(this._actualGeometry, padding);
    let slots = strategy.computeWindowSlots(layout, area);

    let workspaceManager = global.workspace_manager;
    let currentWorkspace = workspaceManager.get_active_workspace();
    let isOnCurrentWorkspace = this.metaWorkspace == null || this.metaWorkspace == currentWorkspace;

    for (let i = 0; i < slots.length; i++) {
        let slot = slots[i];
        let [x, y, scale, clone] = slot;

        clone.slotId = i;

        // Positioning a window currently being dragged must be avoided;
        // we'll just leave a blank spot in the layout for it.
        if (clone.inDrag)
            continue;

        let cloneWidth = clone.actor.width * scale;
        let cloneHeight = clone.actor.height * scale;
        clone.slot = [x, y, cloneWidth, cloneHeight];

        let cloneCenter = x + cloneWidth / 2;
        let maxChromeWidth = 2 * Math.min(
            cloneCenter - area.x,
            area.x + area.width - cloneCenter);
        clone.overlay.setMaxChromeWidth(Math.round(maxChromeWidth));

        if (clone.overlay && (initialPositioning || !clone.positioned))
            clone.overlay.hide();

        if (!clone.positioned) {
            // This window appeared after the overview was already up
            // Grow the clone from the center of the slot
            clone.actor.x = x + cloneWidth / 2;
            clone.actor.y = y + cloneHeight / 2;
            clone.actor.scale_x = 0;
            clone.actor.scale_y = 0;
            clone.positioned = true;
        }

        // !!!!!!!!!!!!!!!!!!!!!!!!!!! //
        // OverviewAllWorkspaces change: don't check isOnCurrentWorkspace
        // !!!!!!!!!!!!!!!!!!!!!!!!!!! //
        if (animate) {
            if (!clone.metaWindow.showing_on_its_workspace()) {
                /* Hidden windows should fade in and grow
                 * therefore we need to resize them now so they
                 * can be scaled up later */
                if (initialPositioning) {
                    clone.actor.opacity = 0;
                    clone.actor.scale_x = 0;
                    clone.actor.scale_y = 0;
                    clone.actor.x = x;
                    clone.actor.y = y;
                }

                Tweener.addTween(clone.actor,
                                 { opacity: 255,
                                   time: Overview.ANIMATION_TIME,
                                   transition: 'easeInQuad'
                                 });
            }

            this._animateClone(clone, clone.overlay, x, y, scale);
        } else {
            // cancel any active tweens (otherwise they might override our changes)
            Tweener.removeTweens(clone.actor);
            clone.actor.set_position(x, y);
            clone.actor.set_scale(scale, scale);
            clone.actor.set_opacity(255);
            clone.overlay.relayout(false);
            this._showWindowOverlay(clone, clone.overlay);
        }
    }
};

var fadeToOverview = function() {
    // We don't want to reposition windows while animating in this way.
    this._animatingWindowsFade = true;
    this._overviewShownId = Main.overview.connect('shown', this._doneShowingOverview.bind(this));
    if (this._windows.length == 0)
        return;

    let nTimeSlots = Math.min(Workspace.WINDOW_ANIMATION_MAX_NUMBER_BLENDING + 1, this._windows.length - 1);
    let windowBaseTime = Overview.ANIMATION_TIME / nTimeSlots;

    let topIndex = this._windows.length - 1;
    for (let i = 0; i < this._windows.length; i++) {
        let fromTop = topIndex - i;
        let time;
        if (fromTop < nTimeSlots) // animate top-most windows gradually
            time = windowBaseTime * (nTimeSlots - fromTop);
        else
            time = windowBaseTime;

        this._windows[i].actor.opacity = 255;
        this._fadeWindow(i, time, 0);
    }
};

var fadeFromOverview = function() {
    this.leavingOverview = true;
    this._overviewHiddenId = Main.overview.connect('hidden', this._doneLeavingOverview.bind(this));
    if (this._windows.length == 0)
        return;

    for (let i = 0; i < this._windows.length; i++) {
        let clone = this._windows[i];
        Tweener.removeTweens(clone.actor);
    }

    if (this._repositionWindowsId > 0) {
        Mainloop.source_remove(this._repositionWindowsId);
        this._repositionWindowsId = 0;
    }

    let nTimeSlots = Math.min(Workspace.WINDOW_ANIMATION_MAX_NUMBER_BLENDING + 1, this._windows.length - 1);
    let windowBaseTime = Overview.ANIMATION_TIME / nTimeSlots;

    let topIndex = this._windows.length - 1;
    for (let i = 0; i < this._windows.length; i++) {
        let fromTop = topIndex - i;
        let time;
        if (fromTop < nTimeSlots) // animate top-most windows gradually
            time = windowBaseTime * (fromTop + 1);
        else
            time = windowBaseTime * nTimeSlots;

        this._windows[i].actor.opacity = 0;
        this._fadeWindow(i, time, 255);
    }
};

// Animates the return from Overview mode in Workspace.Workspace
var zoomFromOverview = function() {
    let workspaceManager = global.workspace_manager;
    let currentWorkspace = workspaceManager.get_active_workspace();

    this.leavingOverview = true;

    for (let i = 0; i < this._windows.length; i++) {
        let clone = this._windows[i];
        Tweener.removeTweens(clone.actor);
    }

    if (this._repositionWindowsId > 0) {
        Mainloop.source_remove(this._repositionWindowsId);
        this._repositionWindowsId = 0;
    }
    this._overviewHiddenId = Main.overview.connect('hidden', this._doneLeavingOverview.bind(this));

    // Position and scale the windows.
    for (let i = 0; i < this._windows.length; i++) {
        let clone = this._windows[i];
        let overlay = this._windowOverlays[i];

        if (overlay)
            overlay.hide();

        if (clone.metaWindow.showing_on_its_workspace() &&
            clone.metaWindow.get_workspace() === currentWorkspace &&
            clone.metaWindow.get_monitor() === this.monitorIndex) {

            let origX, origY;
            [origX, origY] = clone.getOriginalPosition();

            Tweener.addTween(clone.actor,
                             { x: origX,
                               y: origY,
                               scale_x: 1.0,
                               scale_y: 1.0,
                               time: Overview.ANIMATION_TIME,
                               opacity: 255,
                               transition: 'easeOutQuad'
                             });
        } else {
            // The window is hidden, make it shrink and fade it out
            Tweener.addTween(clone.actor,
                             { scale_x: 0,
                               scale_y: 0,
                               opacity: 0,
                               time: Overview.ANIMATION_TIME,
                               transition: 'easeOutQuad'
                             });
        }
    }
};
