// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

//The following is my own version of WorkspacesView.WorkspacesView
//It is designed to work with only one "Workspace" containing all windows

const { Clutter, Gio, GObject, Meta, Shell, St } = imports.gi;
const Signals = imports.signals;

const Main = imports.ui.main;
const Tweener = imports.ui.tweener;
const Workspace = imports.ui.workspace;

const WorkspacesView = imports.ui.workspacesView;

const WORKSPACE_SWITCH_TIME = WorkspacesView.WORKSPACE_SWITCH_TIME;

var UnifiedWorkspacesView = class extends WorkspacesView.WorkspacesViewBase {
    constructor(monitorIndex) {
        let workspaceManager = global.workspace_manager;

        super(monitorIndex);

        this._animating = false; // tweening
        this._scrolling = false; // swipe-scrolling
        this._gestureActive = false; // touch(pad) gestures
        this._animatingScroll = false; // programatically updating the adjustment

        let activeWorkspaceIndex = workspaceManager.get_active_workspace_index();
        this.scrollAdjustment = new St.Adjustment({ value: activeWorkspaceIndex,
                                                    lower: 0,
                                                    page_increment: 1,
                                                    page_size: 1,
                                                    step_increment: 0,
                                                    upper: workspaceManager.n_workspaces });
        this.scrollAdjustment.connect('notify::value',
                                      this._onScroll.bind(this));

        this._workspace = new Workspace.Workspace(null, this._monitorIndex);
        this.actor.add_actor(this._workspace.actor);
        this._updateWorkspaces();
        this._updateWorkspacesId =
            workspaceManager.connect('notify::n-workspaces',
                                     this._updateWorkspaces.bind(this));

        this._overviewShownId =
            Main.overview.connect('shown', () => {
                this.actor.set_clip(this._fullGeometry.x, this._fullGeometry.y,
                                    this._fullGeometry.width, this._fullGeometry.height);
            });

        this._switchWorkspaceNotifyId =
            global.window_manager.connect('switch-workspace',
                                          this._activeWorkspaceChanged.bind(this));
    }

    _setReservedSlot(window) {
        this._workspace.setReservedSlot(window);
    }

    _syncFullGeometry() {
        this._workspace.setFullGeometry(this._fullGeometry);
    }

    _syncActualGeometry() {
        this._workspace.setActualGeometry(this._actualGeometry);
    }

    getActiveWorkspace() {
        return this._workspace;
    }

    animateToOverview(animationType) {
        if (animationType == WorkspacesView.AnimationType.ZOOM) {
            this._workspace.zoomToOverview();
        } else {
            this._workspace.fadeToOverview();
        }
        this._updateWorkspaceActors(false);
    }

    animateFromOverview(animationType) {
        this.actor.remove_clip();

        if (animationType == WorkspacesView.AnimationType.ZOOM) {
            this._workspace.zoomFromOverview();
        } else {
            this._workspace.fadeFromOverview();
        }
    }

    syncStacking(stackIndices) {
        this._workspace.syncStacking(stackIndices);
    }

    _scrollToActive() {
        this._updateWorkspaceActors(true);
    }

    // Update workspace actors parameters
    // @showAnimation: iff %true, transition between states
    _updateWorkspaceActors(showAnimation) {
        let active = global.screen.get_active_workspace_index();

        this._animating = showAnimation;

        Tweener.removeTweens(this._workspace.actor);

        if (showAnimation) {
            let params = { y: 0,
                           time: WORKSPACE_SWITCH_TIME,
                           transition: 'easeOutQuad',
                           onComplete: () => {
                               this._animating = false;
                               this._updateVisibility();
                           }
                         };
            this._updateVisibility();
            Tweener.addTween(this._workspace.actor, params);
        } else {
            this._workspace.actor.set_position(0, 0);
            this._updateVisibility();
        }
    }

    _updateVisibility() {
        this._workspace.actor.show();
    }

    _updateScrollAdjustment(index) {
    }

    _updateWorkspaces() {
    }

    _activeWorkspaceChanged(wm, from, to, direction) {
        if (this._scrolling)
            return;

        this._scrollToActive();
    }

    _onDestroy() {
        super._onDestroy();

        this.scrollAdjustment.run_dispose();
        Main.overview.disconnect(this._overviewShownId);
        global.window_manager.disconnect(this._switchWorkspaceNotifyId);
        let workspaceManager = global.workspace_manager;
        workspaceManager.disconnect(this._updateWorkspacesId);
    }

    startSwipeScroll() {
    }

    endSwipeScroll() {
    }

    startTouchGesture() {
    }

    endTouchGesture() {
    }

    // sync the workspaces' positions to the value of the scroll adjustment
    // and change the active workspace if appropriate
    _onScroll(adj) {
    }
};
Signals.addSignalMethods(UnifiedWorkspacesView.prototype);
