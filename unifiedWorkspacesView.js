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

var UnifiedWorkspacesView = GObject.registerClass(
class UnifiedWorkspacesView extends WorkspacesView.WorkspacesViewBase {
    _init(monitorIndex, scrollAdjustment) {
        let workspaceManager = global.workspace_manager;

        super._init(monitorIndex);

        this._animating = false; // tweening
        this._gestureActive = false; // touch(pad) gestures

        this._scrollAdjustment = scrollAdjustment;
        this._onScrollId =
            this._scrollAdjustment.connect('notify::value',
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

    // Update workspace actors parameters
    // @showAnimation: iff %true, transition between states
    _updateWorkspaceActors(showAnimation) {
        let workspaceManager = global.workspace_manager;
        let active = global.screen.get_active_workspace_index();

        this._animating = showAnimation;

        this._workspace.remove_all_transitions();

        let w = 0;

        let params = {};
        if (workspaceManager.layout_rows == -1)
            params.y = (w - active) * this._fullGeometry.height;
        else if (this.text_direction == Clutter.TextDirection.RTL)
            params.x = (active - w) * this._fullGeometry.width;
        else
            params.x = (w - active) * this._fullGeometry.width;

        if (showAnimation) {
            let easeParams = Object.assign(params, {
                duration: WORKSPACE_SWITCH_TIME,
                mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
            });
            // we have to call _updateVisibility() once before the
            // animation and once afterwards - it does not really
            // matter which tween we use, so we pick the first one ...
            if (w == 0) {
                this._updateVisibility();
                easeParams.onComplete = () => {
                    this._animating = false;
                    this._updateVisibility();
                };
            }
            workspace.ease(easeParams);
        } else {
            workspace.set(params);
            if (w == 0)
                this._updateVisibility();
        }
    }

    _updateVisibility() {
        this._workspace.actor.show();
    }

    _updateWorkspaces() {
    }

    _activeWorkspaceChanged(wm, from, to, direction) {
        if (this._scrolling)
            return;

        this._updateWorkspaceActors(true);
    }

    _onDestroy() {
        super._onDestroy();

        this.scrollAdjustment.disconnect(this._onScrollId);
        Main.overview.disconnect(this._overviewShownId);
        global.window_manager.disconnect(this._switchWorkspaceNotifyId);
        let workspaceManager = global.workspace_manager;
        workspaceManager.disconnect(this._updateWorkspacesId);
        workspaceManager.disconnect(this._reorderWorkspacesId);
    }

    startTouchGesture() {
    }

    endTouchGesture() {
    }

    // sync the workspaces' positions to the value of the scroll adjustment
    // and change the active workspace if appropriate
    _onScroll(adj) {
    }
});
