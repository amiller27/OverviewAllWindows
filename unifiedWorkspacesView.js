'use strict';
// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

//The following is my own version of WorkspacesView.WorkspacesView
//It is designed to work with only one "Workspace" containing all windows
const { Clutter, GObject, Meta, Shell, St } = imports.gi;
const Signals = imports.signals;

const Main = imports.ui.main;
const Workspace = imports.ui.workspace;
const WorkspacesView = imports.ui.workspacesView;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = imports.misc.extensionUtils.getCurrentExtension();

var UnifiedWorkspacesView = GObject.registerClass(
class UnifiedWorkspacesView extends WorkspacesView.WorkspacesViewBase {
    _init(monitorIndex, scrollAdjustment) {
        super._init(monitorIndex);

        let workspaceManager = global.workspace_manager;
        this._animating = false; // tweening
        this._gestureActive = false; // touch(pad) gestures
        this._scrollAdjustment = scrollAdjustment;

        this._workspace = new Workspace.Workspace(null, this._monitorIndex);
        this.add_actor(this._workspace);

        this._overviewShownId =
            Main.overview.connect('shown', () => {
                this.set_clip(this._fullGeometry.x, this._fullGeometry.y,
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
        this.remove_clip();

        if (animationType == WorkspacesView.AnimationType.ZOOM) {
            this._workspace.zoomFromOverview();
        } else {
            this._workspace.fadeFromOverview();
        }
    }

    animateScroll(params) {
        this._updateVisibility();
        this._workspace.ease(params, {
            duration: WorkspacesView.WORKSPACE_SWITCH_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_CUBIC,
            onComplete: () => {
                this._animating = false;
                this._updateVisibility();
            },
        });
    }

    syncStacking(stackIndices) {
        this._workspace.syncStacking(stackIndices);
    }

    // Update workspace actors parameters
    // @showAnimation: iff %true, transition between states
    _updateWorkspaceActors(showAnimation, from, to) {
        this._animating = showAnimation;
        const workspaceManager = global.workspace_manager;
        let params = {};
        const active = to - from > 0 ? 1 : -1;

        const isVertical = workspaceManager.layout_rows == -1;
        this._workspace.remove_all_transitions();

        if (showAnimation) {
            const settings = ExtensionUtils.getSettings('org.gnome.desktop.interface');
            const isAnimationsEnabled = settings.get_boolean('enable-animations');
            if (isVertical)
                params.y = active * this._fullGeometry.height;
            else if (this.text_direction == Clutter.TextDirection.RTL)
                params.x = -active * this._fullGeometry.width;
            else
                params.x = active * this._fullGeometry.width;

            if (isVertical) {
                this._workspace.set(params);
                params.y = 0;
            } else {
                this._workspace.set(params);
                params.x = 0;
            }

            if (isAnimationsEnabled) {
                this.animateScroll(params);
            } else {
                this._workspace.set(params);
            }
        } else {
            this._updateVisibility();
        }
    }

    _updateVisibility() {
        this._workspace.show();
    }

    _updateWorkspaces() {
    }

    _activeWorkspaceChanged(_wm, _from, _to, _direction) {
        if (this._scrolling)
            return;

        this._updateWorkspaceActors(true, _from, _to);
    }

    _onDestroy() {
        super._onDestroy();

        Main.overview.disconnect(this._overviewShownId);
        global.window_manager.disconnect(this._switchWorkspaceNotifyId);
    }

    startTouchGesture() {
    }

    endTouchGesture() {
    }

    // sync the workspaces' positions to the value of the scroll adjustment
    // and change the active workspace if appropriate
    _onScroll(_adj) {
    }

});
