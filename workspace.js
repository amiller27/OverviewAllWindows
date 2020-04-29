const GLib = imports.gi.GLib;
const Clutter = imports.gi.Clutter;
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

        let cloneWidth = clone.width * scale;
        let cloneHeight = clone.height * scale;
        clone.slot = [x, y, cloneWidth, cloneHeight];

        let cloneCenter = x + cloneWidth / 2;
        let maxChromeWidth = 2 * Math.min(
            cloneCenter - area.x,
            area.x + area.width - cloneCenter);
        clone.overlay.setMaxChromeWidth(Math.round(maxChromeWidth));

        if (clone.overlay && (initialPositioning || !clone.positioned))
            clone.overlay.hide();

        // !!!!!!!!!!!!!!!!!!!!!!!!!!! //
        // OverviewAllWorkspaces change: also grow windows on other workspaces
        // !!!!!!!!!!!!!!!!!!!!!!!!!!! //
        if (!clone.positioned || clone.metaWindow.get_workspace() !== currentWorkspace) {
            // This window appeared after the overview was already up
            // Grow the clone from the center of the slot
            clone.translation_x = x + cloneWidth / 2;
            clone.translation_y = y + cloneHeight / 2;
            clone.scale_x = 0;
            clone.scale_y = 0;
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
                    clone.opacity = 0;
                    clone.scale_x = 0;
                    clone.scale_y = 0;
                    clone.translation_x = x;
                    clone.translation_y = y;
                }

                clone.ease({
                    opacity: 255,
                    mode: Clutter.AnimationMode.EASE_IN_QUAD,
                    duration: Overview.ANIMATION_TIME,
                });
            }

            this._animateClone(clone, clone.overlay, x, y, scale);
        } else {
            // cancel any active tweens (otherwise they might override our changes)
            clone.remove_all_transitions();
            clone.set_translation(x, y, 0);
            clone.set_scale(scale, scale);
            clone.set_opacity(255);
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

    // !!!!!!!!!!!!!!!!!!!!!!!!!!! //
    // OverviewAllWorkspaces changes:
    // remove shortcircuits for windows we otherwise wouldn't animate
    // remove topMaximizedWindow
    // !!!!!!!!!!!!!!!!!!!!!!!!!!! //

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

        this._windows[i].opacity = 255;
        this._fadeWindow(i, time, 0);
    }
};

var fadeFromOverview = function() {
    this.leavingOverview = true;
    this._overviewHiddenId = Main.overview.connect('hidden', this._doneLeavingOverview.bind(this));
    if (this._windows.length == 0)
        return;

    for (let i = 0; i < this._windows.length; i++) {
        this._windows[i].remove_all_transitions();
    }

    if (this._repositionWindowsId > 0) {
        GLib.source_remove(this._repositionWindowsId);
        this._repositionWindowsId = 0;
    }

    // !!!!!!!!!!!!!!!!!!!!!!!!!!! //
    // OverviewAllWorkspaces changes:
    // remove shortcircuits for windows we otherwise wouldn't animate
    // remove topMaximizedWindow
    // !!!!!!!!!!!!!!!!!!!!!!!!!!! //

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

        this._windows[i].opacity = 0;
        this._fadeWindow(i, time, 255);
    }
};

// Animates the return from Overview mode in Workspace.Workspace
var zoomFromOverview = function() {
    let workspaceManager = global.workspace_manager;
    let currentWorkspace = workspaceManager.get_active_workspace();

    this.leavingOverview = true;

    for (let i = 0; i < this._windows.length; i++) {
        this._windows[i].remove_all_transitions();
    }

    if (this._repositionWindowsId > 0) {
        GLib.source_remove(this._repositionWindowsId);
        this._repositionWindowsId = 0;
    }
    this._overviewHiddenId = Main.overview.connect('hidden', this._doneLeavingOverview.bind(this));

    // !!!!!!!!!!!!!!!!!!!!!!!!!!! //
    // OverviewAllWorkspaces changes: remove early return here
    // !!!!!!!!!!!!!!!!!!!!!!!!!!! //

    // Position and scale the windows.
    for (let i = 0; i < this._windows.length; i++) {
        // !!!!!!!!!!!!!!!!!!!!!!!!!!! //
        // OverviewAllWorkspaces changes: inline loop here
        // !!!!!!!!!!!!!!!!!!!!!!!!!!! //

        let clone = this._windows[i];
        let overlay = this._windowOverlays[i];

        if (overlay)
            overlay.hide();

        // !!!!!!!!!!!!!!!!!!!!!!!!!!! //
        // OverviewAllWorkspaces changes: extra conditions here
        // !!!!!!!!!!!!!!!!!!!!!!!!!!! //

        if (clone.metaWindow.showing_on_its_workspace() &&
            clone.metaWindow.get_workspace() === currentWorkspace &&
            clone.metaWindow.get_monitor() === this.monitorIndex) {

            let [origX, origY] = clone.getOriginalPosition();
            clone.ease({
                translation_x: origX,
                translation_y: origY,
                scale_x: 1,
                scale_y: 1,
                opacity: 255,
                duration: Overview.ANIMATION_TIME,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        } else {
            // The window is hidden, make it shrink and fade it out
            clone.ease({
                scale_x: 0,
                scale_y: 0,
                opacity: 0,
                duration: Overview.ANIMATION_TIME,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        }
    }
};
