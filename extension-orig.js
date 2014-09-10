const Signals = imports.signals;
const DND = imports.ui.dnd;
const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const Workspace = imports.ui.workspace;
const WorkspacesView = imports.ui.workspacesView;

const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const St = imports.gi.St;

const Lang = imports.lang;

const OVERRIDE_SCHEMA = WorkspacesView.OVERRIDE_SCHEMA;
const WORKSPACE_SWITCH_TIME = WorkspacesView.WORKSPACE_SWITCH_TIME;

//The following is my own version of WorkspacesView.WorkspacesView
//It is designed to work with only one "Workspace" containing all windows

const UnifiedWorkspacesView = new Lang.Class({
    Name: 'UnifiedWorkspacesView',
    Extends: WorkspacesView.WorkspacesView,

    _init: function(workspaces) {
        this.actor = new St.Widget({ style_class: 'workspaces-view',
                                     reactive: true });

        // The actor itself isn't a drop target, so we don't want to pick on its area
        this.actor.set_size(0, 0);

        this.actor.connect('destroy', Lang.bind(this, this._onDestroy));

        this.actor.connect('style-changed', Lang.bind(this,
            function() {
                let node = this.actor.get_theme_node();
                this._spacing = node.get_length('spacing');
                this._updateWorkspaceActors(false);
            }));

        this._fullGeometry = null;
        this._actualGeometry = null;

        this._spacing = 0;
        this._animating = false; // tweening
        this._scrolling = false; // swipe-scrolling
        this._animatingScroll = false; // programatically updating the adjustment
        this._inDrag = false; // dragging a window

        this._settings = new Gio.Settings({ schema: OVERRIDE_SCHEMA });
        // ''''function (REMOVED_THIS_HERE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!)
        /*
        this._updateExtraWorkspacesId =
            this._settings.connect('changed::workspaces-only-on-primary',
                                   Lang.bind(this, this._updateExtraWorkspaces));
        */

        let activeWorkspaceIndex = global.screen.get_active_workspace_index();
        // ''''function (REPLACED_THIS_HERE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!)
        /*
        this._workspaces = workspaces;
        */
        this._workspace = workspaces[0];//new Workspace.Workspace(null, 0);
        for (let w = 1; w<workspaces.length; w++) {
            workspaces[w].destroy();
        }
        // END INSERTED CODE

        // Add workspace actors
        // ''''function (REPLACED_THIS_HERE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!)
        /*
        for (let w = 0; w < global.screen.n_workspaces; w++)
            this.actor.add_actor(this._workspaces[w].actor);
        this._workspaces[activeWorkspaceIndex].actor.raise_top();
        */
        this.actor.add_actor(this._workspace.actor);
        this._workspace.actor.raise_top();

        // ''''function (REMOVED_THIS_HERE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!)        
        /*
        this._extraWorkspaces = [];
        this._updateExtraWorkspaces();
        */

        // Position/scale the desktop windows and their children after the
        // workspaces have been created. This cannot be done first because
        // window movement depends on the Workspaces object being accessible
        // as an Overview member.
        // ''''function (REPLACED_THIS_HERE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!)
        /*
        this._overviewShowingId =
            Main.overview.connect('showing',
                                 Lang.bind(this, function() {
                for (let w = 0; w < this._workspaces.length; w++)
                    this._workspaces[w].zoomToOverview();
                for (let w = 0; w < this._extraWorkspaces.length; w++)
                    this._extraWorkspaces[w].zoomToOverview();
        }));
        */
        this._overviewShowingId = Main.overview.connect('showing',
            Lang.bind(this, function() {
                this._workspace.zoomToOverview();
        }));
        this._overviewShownId =
            Main.overview.connect('shown',
                                 Lang.bind(this, function() {
                this.actor.set_clip(this._fullGeometry.x, this._fullGeometry.y,
                                    this._fullGeometry.width, this._fullGeometry.height);
        }));

        this.scrollAdjustment = new St.Adjustment({ value: activeWorkspaceIndex,
                                                    lower: 0,
                                                    page_increment: 1,
                                                    page_size: 1,
                                                    step_increment: 0,
        //''''function (REPLACED_THIS_HERE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!)
        /*
                                                    upper: this._workspaces.length });
        */
                                                    upper: 1 });
        this.scrollAdjustment.connect('notify::value',
                                      Lang.bind(this, this._onScroll));

        this._switchWorkspaceNotifyId =
            global.window_manager.connect('switch-workspace',
                                          Lang.bind(this, this._activeWorkspaceChanged));

        this._itemDragBeginId = Main.overview.connect('item-drag-begin',
                                                      Lang.bind(this, this._dragBegin));
        this._itemDragEndId = Main.overview.connect('item-drag-end',
                                                     Lang.bind(this, this._dragEnd));
        this._windowDragBeginId = Main.overview.connect('window-drag-begin',
                                                        Lang.bind(this, this._dragBegin));
        this._windowDragEndId = Main.overview.connect('window-drag-end',
                                                      Lang.bind(this, this._dragEnd));
    },

    _updateExtraWorkspaces: function() {
    // ''''function (REMOVED_THIS_HERE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!)
    /*
        this._destroyExtraWorkspaces();

        if (!this._settings.get_boolean('workspaces-only-on-primary'))
            return;

        let monitors = Main.layoutManager.monitors;
        for (let i = 0; i < monitors.length; i++) {
            if (i == Main.layoutManager.primaryIndex)
                continue;

            let ws = new Workspace.Workspace(null, i);
            ws.setFullGeometry(monitors[i]);
            ws.setActualGeometry(monitors[i]);
            Main.layoutManager.overviewGroup.add_actor(ws.actor);
            this._extraWorkspaces.push(ws);
        }
    */
    },

    _destroyExtraWorkspaces: function() {
    // ''''function (REMOVED_THIS_HERE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!)
    /*
        for (let m = 0; m < this._extraWorkspaces.length; m++)
            this._extraWorkspaces[m].destroy();
        this._extraWorkspaces = [];
    */
    },

    setFullGeometry: function(geom) {
        if (WorkspacesView.rectEqual(this._fullGeometry, geom))
            return;

        this._fullGeometry = geom;

        // ''''function (REPLACED_THIS_HERE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!)
        /*
        for (let i = 0; i < this._workspaces.length; i++)
            this._workspaces[i].setFullGeometry(geom);
        */
        this._workspace.setFullGeometry(geom);
    },

    setActualGeometry: function(geom) {
        if (WorkspacesView.rectEqual(this._actualGeometry, geom))
            return;

        this._actualGeometry = geom;

        // ''''function (REPLACED_THIS_HERE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!)
        /*
        for (let i = 0; i < this._workspaces.length; i++)
            this._workspaces[i].setActualGeometry(geom);
        */
        this._workspace.setActualGeometry(geom);
    },

    getActiveWorkspace: function() {
        // ''''function (REPLACED_THIS_HERE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!)
        /*        
        let active = global.screen.get_active_workspace_index();
        return this._workspaces[active];
        */
        return this._workspace;
    },

    hide: function() {
        // ''''function (REPLACED_THIS_HERE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!)
        /*
        let activeWorkspaceIndex = global.screen.get_active_workspace_index();
        let activeWorkspace = this._workspaces[activeWorkspaceIndex];

        activeWorkspace.actor.raise_top();
        */
        this._workspace.actor.raise_top();

        this.actor.remove_clip();

        // ''''function (REPLACED_THIS_HERE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!)
        /*
        for (let w = 0; w < this._workspaces.length; w++)
            this._workspaces[w].zoomFromOverview();
        for (let w = 0; w < this._extraWorkspaces.length; w++)
            this._extraWorkspaces[w].zoomFromOverview();
        */
        this._workspace.zoomFromOverview();
    },

    destroy: function() {
        this.actor.destroy();
    },

    syncStacking: function(stackIndices) {
        // ''''function (REPLACED_THIS_HERE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!)
        /*
        for (let i = 0; i < this._workspaces.length; i++)
            this._workspaces[i].syncStacking(stackIndices);
        for (let i = 0; i < this._extraWorkspaces.length; i++)
            this._extraWorkspaces[i].syncStacking(stackIndices);
        */
        this._workspace.syncStacking(stackIndices);
    },

    _scrollToActive: function() {
        // ''''function (REMOVED_THIS_HERE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!)
        /*
        let active = global.screen.get_active_workspace_index();
        */

        this._updateWorkspaceActors(true);
        // ''''function (REMOVED_THIS_HERE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!)
        /*
        this._updateScrollAdjustment(active);
        */
    },

    // Update workspace actors parameters
    // @showAnimation: iff %true, transition between states
    _updateWorkspaceActors: function(showAnimation) {
        // ''''function(REPLACED_THIS_HERE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!)
        /*
        let active = global.screen.get_active_workspace_index();

        this._animating = showAnimation;

        for (let w = 0; w < this._workspaces.length; w++) {
            let workspace = this._workspaces[w];

            Tweener.removeTweens(workspace.actor);

            let y = (w - active) * (this._fullGeometry.height + this._spacing);

            if (showAnimation) {
                let params = { y: y,
                               time: WORKSPACE_SWITCH_TIME,
                               transition: 'easeOutQuad'
                             };
                // we have to call _updateVisibility() once before the
                // animation and once afterwards - it does not really
                // matter which tween we use, so we pick the first one ...
                if (w == 0) {
                    this._updateVisibility();
                    params.onComplete = Lang.bind(this,
                        function() {
                            this._animating = false;
                            this._updateVisibility();
                        });
                }
                Tweener.addTween(workspace.actor, params);
            } else {
                workspace.actor.set_position(0, y);
                if (w == 0)
                    this._updateVisibility();
            }
        }
        */

        this._animating = showAnimation;
        Tweener.removeTweens(this._workspace.actor);
        if (showAnimation) {
            let params = { y: 0,
                           time: WORKSPACE_SWITCH_TIME,
                           transition: 'easeOutQuad',
                           onComplete: Lang.bind(this, function() {
                               this._animating = false;
                               this._updateVisibility();
                           })
                         };
            this._updateVisibility();
            Tweener.addTween(this._workspace.actor, params);
        } else {
            this._workspace.actor.set_position(0, 0);
            this._updateVisibility();
        }
    },

    _updateVisibility: function() {
        // ''''function (REPLACED_THIS_HERE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!)
        /*
        let active = global.screen.get_active_workspace_index();

        for (let w = 0; w < this._workspaces.length; w++) {
            let workspace = this._workspaces[w];
            if (this._animating || this._scrolling) {
                workspace.actor.show();
            } else {
                if (this._inDrag)
                    workspace.actor.visible = (Math.abs(w - active) <= 1);
                else
                    workspace.actor.visible = (w == active);
            }
        }
        */
        this._workspace.actor.show();
    },

    _updateScrollAdjustment: function(index) {
        // ''''function(REMOVED_THIS_HERE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!)
        /*
        if (this._scrolling)
            return;

        this._animatingScroll = true;

        Tweener.addTween(this.scrollAdjustment, {
            value: index,
            time: WORKSPACE_SWITCH_TIME,
            transition: 'easeOutQuad',
            onComplete: Lang.bind(this,
                                  function() {
                                      this._animatingScroll = false;
                                  })
        });
        */
    },

    updateWorkspaces: function(oldNumWorkspaces, newNumWorkspaces) {
        // ''''function (REMOVED_THIS_HERE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!)
        /*
        let active = global.screen.get_active_workspace_index();

        Tweener.addTween(this.scrollAdjustment,
                         { upper: newNumWorkspaces,
                           time: WORKSPACE_SWITCH_TIME,
                           transition: 'easeOutQuad'
                         });

        if (newNumWorkspaces > oldNumWorkspaces) {
            for (let w = oldNumWorkspaces; w < newNumWorkspaces; w++) {
                this._workspaces[w].setFullGeometry(this._fullGeometry);
                if (this._actualGeometry)
                    this._workspaces[w].setActualGeometry(this._actualGeometry);
                this.actor.add_actor(this._workspaces[w].actor);
            }

            this._updateWorkspaceActors(false);
        }
        */
    },

    _activeWorkspaceChanged: function(wm, from, to, direction) {
        if (this._scrolling)
            return;

        this._scrollToActive();
    },

    _onDestroy: function() {
        // ''''function (REMOVED_THIS_HERE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!)
        /*
        this._destroyExtraWorkspaces();
        */
        this.scrollAdjustment.run_dispose();
        Main.overview.disconnect(this._overviewShowingId);
        Main.overview.disconnect(this._overviewShownId);
        global.window_manager.disconnect(this._switchWorkspaceNotifyId);
        // ''''function (REMOVED_THIS_HERE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!)
        /*
        this._settings.disconnect(this._updateExtraWorkspacesId);
        */

        if (this._inDrag)
            this._dragEnd();

        if (this._itemDragBeginId > 0) {
            Main.overview.disconnect(this._itemDragBeginId);
            this._itemDragBeginId = 0;
        }
        if (this._itemDragEndId > 0) {
            Main.overview.disconnect(this._itemDragEndId);
            this._itemDragEndId = 0;
        }
        if (this._windowDragBeginId > 0) {
            Main.overview.disconnect(this._windowDragBeginId);
            this._windowDragBeginId = 0;
        }
        if (this._windowDragEndId > 0) {
            Main.overview.disconnect(this._windowDragEndId);
            this._windowDragEndId = 0;
        }
    },

    _dragBegin: function() {
        if (this._scrolling)
            return;

        this._inDrag = true;
        this._firstDragMotion = true;

        this._dragMonitor = {
            dragMotion: Lang.bind(this, this._onDragMotion)
        };
        DND.addDragMonitor(this._dragMonitor);
    },

    _onDragMotion: function(dragEvent) {
        if (Main.overview.animationInProgress)
             return DND.DragMotionResult.CONTINUE;

        if (this._firstDragMotion) {
            this._firstDragMotion = false;
            // ''''function (REPLACED_THIS_HERE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!)
            /*
            for (let i = 0; i < this._workspaces.length; i++)
                this._workspaces[i].setReservedSlot(dragEvent.dragActor._delegate);
            for (let i = 0; i < this._extraWorkspaces.length; i++)
                this._extraWorkspaces[i].setReservedSlot(dragEvent.dragActor._delegate);
            */
            this._workspace.setReservedSlot(dragEvent.dragActor._delegate);
        }

        return DND.DragMotionResult.CONTINUE;
    },

    _dragEnd: function() {
        DND.removeDragMonitor(this._dragMonitor);
        this._inDrag = false;

        // ''''function (REPLACED_THIS_HERE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!)
        /*
        for (let i = 0; i < this._workspaces.length; i++)
            this._workspaces[i].setReservedSlot(null);
        for (let i = 0; i < this._extraWorkspaces.length; i++)
            this._extraWorkspaces[i].setReservedSlot(null);
        */
        this._workspace.setReservedSlot(null);
    },

    startSwipeScroll: function() {
        this._scrolling = true;
    },

    endSwipeScroll: function() {
        this._scrolling = false;

        // Make sure title captions etc are shown as necessary
        this._scrollToActive();
        this._updateVisibility();
    },

    // sync the workspaces' positions to the value of the scroll adjustment
    // and change the active workspace if appropriate
    _onScroll: function(adj) {
    // ''''function (REMOVED_THIS_HERE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!)
    /*
        if (this._animatingScroll)
            return;

        let active = global.screen.get_active_workspace_index();
        let current = Math.round(adj.value);

        if (active != current) {
            if (!this._workspaces[current]) {
                // The current workspace was destroyed. This could happen
                // when you are on the last empty workspace, and consolidate
                // windows using the thumbnail bar.
                // In that case, the intended behavior is to stay on the empty
                // workspace, which is the last one, so pick it.
                current = this._workspaces.length - 1;
            }

            let metaWorkspace = this._workspaces[current].metaWorkspace;
            metaWorkspace.activate(global.get_current_time());
        }

        let last = this._workspaces.length - 1;
        let firstWorkspaceY = this._workspaces[0].actor.y;
        let lastWorkspaceY = this._workspaces[last].actor.y;
        let workspacesHeight = lastWorkspaceY - firstWorkspaceY;

        if (adj.upper == 1)
            return;

        let currentY = firstWorkspaceY;
        let newY =  - adj.value / (adj.upper - 1) * workspacesHeight;

        let dy = newY - currentY;

        for (let i = 0; i < this._workspaces.length; i++) {
            this._workspaces[i].actor.visible = Math.abs(i - adj.value) <= 1;
            this._workspaces[i].actor.y += dy;
        }
    */
    },
});
Signals.addSignalMethods(UnifiedWorkspacesView.prototype);

let _updateWindowPositions = function(flags) {
    if (this._currentLayout == null) {
        this._recalculateWindowPositions(flags);
        return;
    }

    let initialPositioning = flags & WindowPositionFlags.INITIAL;
    let animate = flags & WindowPositionFlags.ANIMATE;

    let layout = this._currentLayout;
    let strategy = layout.strategy;

    let [, , padding] = this._getSpacingAndPadding();
    let area = padArea(this._actualGeometry, padding);
    let slots = strategy.computeWindowSlots(layout, area);

    let currentWorkspace = global.screen.get_active_workspace();
    let isOnCurrentWorkspace = this.metaWorkspace == null || this.metaWorkspace == currentWorkspace;

    for (let i = 0; i < slots.length; i++) {
        let slot = slots[i];
        let [x, y, scale, clone] = slot;
        let metaWindow = clone.metaWindow;
        let overlay = clone.overlay;
        clone.slotId = i;

        // Positioning a window currently being dragged must be avoided;
        // we'll just leave a blank spot in the layout for it.
        if (clone.inDrag)
            continue;

        let cloneWidth = clone.actor.width * scale;
        let cloneHeight = clone.actor.height * scale;
        clone.slot = [x, y, cloneWidth, cloneHeight];

        if (overlay && (initialPositioning || !clone.positioned))
            overlay.hide();

        if (!clone.positioned) {
            // This window appeared after the overview was already up
            // Grow the clone from the center of the slot
            clone.actor.x = x + cloneWidth / 2;
            clone.actor.y = y + cloneHeight / 2;
            clone.actor.scale_x = 0;
            clone.actor.scale_y = 0;
            clone.positioned = true;
        }

        if (animate && isOnCurrentWorkspace) {
            let names = Object.getOwnPropertyNames(metaWindow);
            for (let name in names) {
                log(name);
            }

            if (!metaWindow.showing_on_its_workspace()) {
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

            this._animateClone(clone, overlay, x, y, scale, initialPositioning);
        } else {
            // cancel any active tweens (otherwise they might override our changes)
            Tweener.removeTweens(clone.actor);
            clone.actor.set_position(x, y);
            clone.actor.set_scale(scale, scale);
            clone.actor.set_opacity(255);
            clone.overlay.relayout(false);
            this._showWindowOverlay(clone, overlay);
        }
    }
};


let originalFunctions, originalWorkspacesView;

function init() {
    //nothing here for now
}

function enable() {
    originalFunctions = {};

    originalFunctions['_onCloneSelected'] = Workspace.Workspace.prototype['_onCloneSelected'];
    Workspace.Workspace.prototype['_onCloneSelected'] = function(clone, time) {Main.activateWindow(clone.metaWindow, time)};

    originalFunctions['_isMyWindow'] = Workspace.Workspace.prototype['_isMyWindow'];
    Workspace.Workspace.prototype['_isMyWindow'] = function(actor) { return true; };

    originalWorkspacesView = WorkspacesView.WorkspacesView.prototype;
    WorkspacesView.WorkspacesView.prototype = UnifiedWorkspacesView.prototype;

    Main.overview.viewSelector._workspacesDisplay._updateWorkspacesViews();
}

function disable() {
    Workspace.Workspace.prototype['_onCloneSelected'] = originalFunctions['_onCloneSelected'];
    Workspace.Workspace.prototype['_isMyWindow'] = originalFunctions['_isMyWindow'];

    WorkspacesView.WorkspacesView.prototype = originalWorkspacesView;
    Main.overview.viewSelector._workspacesDisplay._updateWorkspacesViews();
}




