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

        let activeWorkspaceIndex = global.screen.get_active_workspace_index();
        this._workspace = workspaces[0];//new Workspace.Workspace(null, 0);
        for (let w = 1; w<workspaces.length; w++) {
            workspaces[w].destroy();
        }

        // Add workspace actors
        this.actor.add_actor(this._workspace.actor);
        this._workspace.actor.raise_top();

        // Position/scale the desktop windows and their children after the
        // workspaces have been created. This cannot be done first because
        // window movement depends on the Workspaces object being accessible
        // as an Overview member.
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

    _updateExtraWorkspaces: function() {},

    _destroyExtraWorkspaces: function() {},

    setFullGeometry: function(geom) {
        if (WorkspacesView.rectEqual(this._fullGeometry, geom))
            return;

        this._fullGeometry = geom;

        this._workspace.setFullGeometry(geom);
    },

    setActualGeometry: function(geom) {
        if (WorkspacesView.rectEqual(this._actualGeometry, geom))
            return;

        this._actualGeometry = geom;

        this._workspace.setActualGeometry(geom);
    },

    getActiveWorkspace: function() {
        return this._workspace;
    },

    hide: function() {
        this._workspace.actor.raise_top();

        this.actor.remove_clip();

        this._workspace.zoomFromOverview();
    },

    destroy: function() {
        this.actor.destroy();
    },

    syncStacking: function(stackIndices) {
        this._workspace.syncStacking(stackIndices);
    },

    _scrollToActive: function() {
        this._updateWorkspaceActors(true);
    },

    // Update workspace actors parameters
    // @showAnimation: iff %true, transition between states
    _updateWorkspaceActors: function(showAnimation) {
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
        this._workspace.actor.show();
    },

    _updateScrollAdjustment: function(index) {},

    updateWorkspaces: function(oldNumWorkspaces, newNumWorkspaces) {},

    _activeWorkspaceChanged: function(wm, from, to, direction) {
        if (this._scrolling)
            return;

        this._scrollToActive();
    },

    _onDestroy: function() {
        this.scrollAdjustment.run_dispose();
        Main.overview.disconnect(this._overviewShowingId);
        Main.overview.disconnect(this._overviewShownId);
        global.window_manager.disconnect(this._switchWorkspaceNotifyId);

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
            this._workspace.setReservedSlot(dragEvent.dragActor._delegate);
        }

        return DND.DragMotionResult.CONTINUE;
    },

    _dragEnd: function() {
        DND.removeDragMonitor(this._dragMonitor);
        this._inDrag = false;

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
    _onScroll: function(adj) {},
});
Signals.addSignalMethods(UnifiedWorkspacesView.prototype);


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
