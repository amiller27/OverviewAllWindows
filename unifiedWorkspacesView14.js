//The following is my own version of WorkspacesView.WorkspacesView
//It is designed to work with only one "Workspace" containing all windows

const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const St = imports.gi.St;
const Signals = imports.signals;
const Main = imports.ui.main;
const Workspace = imports.ui.workspace;
const Tweener = imports.ui.tweener;
const WorkspacesView = imports.ui.workspacesView;

const Lang = imports.lang;

const OVERRIDE_SCHEMA = WorkspacesView.OVERRIDE_SCHEMA;
const WORKSPACE_SWITCH_TIME = WorkspacesView.WORKSPACE_SWITCH_TIME;

const UnifiedWorkspacesView = new Lang.Class({
    Name: 'UnifiedWorkspacesView',
    Extends: WorkspacesView.WorkspacesViewBase,

    _init: function(monitorIndex) {
        this.parent(monitorIndex);

        this._animating = false; // tweening
        this._scrolling = false; // swipe-scrolling
        this._animatingScroll = false; // programatically updating the adjustment

        this._settings = new Gio.Settings({ schema_id: OVERRIDE_SCHEMA });

        let activeWorkspaceIndex = global.screen.get_active_workspace_index();
        this.scrollAdjustment = new St.Adjustment({ value: activeWorkspaceIndex,
                                                    lower: 0,
                                                    page_increment: 1,
                                                    page_size: 1,
                                                    step_increment: 0,
                                                    upper: 0 });
        this.scrollAdjustment.connect('notify::value',
                                      Lang.bind(this, this._onScroll));

        this._workspace = new Workspace.Workspace(null, this._monitorIndex);
        this.actor.add_actor(this._workspace.actor);
        this._updateWorkspaces();
        this._updateWorkspacesId = global.screen.connect('notify::n-workspaces', Lang.bind(this, this._updateWorkspaces));

        this._overviewShownId =
            Main.overview.connect('shown',
                                 Lang.bind(this, function() {
                this.actor.set_clip(this._fullGeometry.x, this._fullGeometry.y,
                                    this._fullGeometry.width, this._fullGeometry.height);
        }));

        this._switchWorkspaceNotifyId =
            global.window_manager.connect('switch-workspace',
                                          Lang.bind(this, this._activeWorkspaceChanged));
    },

    _setReservedSlot: function(clone) {
        this._workspace.setReservedSlot(clone);
    },

    _syncFullGeometry: function() {
        this._workspace.setFullGeometry(this._fullGeometry);
    },

    _syncActualGeometry: function() {
        this._workspace.setActualGeometry(this._actualGeometry);
    },

    getActiveWorkspace: function() {
        return this._workspace;
    },

    animateToOverview: function(animationType) {
    	if (animationType == WorkspacesView.AnimationType.ZOOM) {
        	this._workspace.zoomToOverview();
        } else {
        	this._workspace.fadeToOverview();
        }
        this._updateWorkspaceActors(false);
    },

    animateFromOverview: function(animationType) {
        this.actor.remove_clip();

        if (animationType == WorkspacesView.AnimationType.ZOOM) {
        	this._workspace.zoomFromOverview();
        } else {
        	this._workspace.fadeFromOverview();
        }
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
        let active = global.screen.get_active_workspace_index();

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

    _updateScrollAdjustment: function(index) {
    },

    _updateWorkspaces: function() {
    },

    _activeWorkspaceChanged: function(wm, from, to, direction) {
        if (this._scrolling)
            return;

        this._scrollToActive();
    },

    _onDestroy: function() {
        this.parent();

        this.scrollAdjustment.run_dispose();
        Main.overview.disconnect(this._overviewShownId);
        global.window_manager.disconnect(this._switchWorkspaceNotifyId);
        global.screen.disconnect(this._updateWorkspacesId);
    },

    startSwipeScroll: function() {
    },

    endSwipeScroll: function() {
    },

    // sync the workspaces' positions to the value of the scroll adjustment
    // and change the active workspace if appropriate
    _onScroll: function(adj) {
    },
});
Signals.addSignalMethods(UnifiedWorkspacesView.prototype);
