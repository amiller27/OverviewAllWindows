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

const WORKSPACE_SWITCH_TIME = WorkspacesView.WORKSPACE_SWITCH_TIME;

var UnifiedWorkspacesView = GObject.registerClass(
class UnifiedWorkspacesView extends WorkspacesView.WorkspacesViewBase {
    _init(monitorIndex, scrollAdjustment) {
        super._init(monitorIndex);
        
        let workspaceManager = global.workspace_manager;

        this._animating = false; // tweening
        this._gestureActive = false; // touch(pad) gestures

        const { x, y, width, height } =
            Main.layoutManager.getWorkAreaForMonitor(monitorIndex);
        this._fullGeometry = { x , y, width, height };

        this._scrollAdjustment = scrollAdjustment;
        this._monitorIndex = monitorIndex;
        this._onScrollId =
            this._scrollAdjustment.connect('notify::value',
                this._onScroll.bind(this));

        this._workspace = new Workspace.Workspace(null, this._monitorIndex);
        this.add_actor(this._workspace);
        this._updateWorkspaces();
        this._updateWorkspacesId =
            workspaceManager.connect('notify::n-workspaces',
                                     this._updateWorkspaces.bind(this));

        this._overviewShownId =
            Main.overview.connect('shown', () => {
                this.set_clip(this._fullGeometry.x, this._fullGeometry.y,
                                    this._fullGeometry.width, this._fullGeometry.height);
            });

        this._switchWorkspaceNotifyId =
            global.window_manager.connect('switch-workspace',
                                          this._activeWorkspaceChanged.bind(this));

        let settings = ExtensionUtils.getSettings('org.gnome.desktop.interface');
        this.isAnimationsEnabled = settings.get_boolean('enable-animations');
    
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

        let workspaceManager = global.workspace_manager;
        let active = workspaceManager.get_active_workspace_index();
        let isEmpty = workspaceManager.n_workspaces - 1 == active;
        if (isEmpty) {
            this._updateWorkspaceActors(true, 1, 0, true)
        }
        
        if (animationType == WorkspacesView.AnimationType.ZOOM) {
            this._workspace.zoomFromOverview();
        } else {
            this._workspace.fadeFromOverview();
        }
        
        }

    animateScroll(params) {
        this._updateVisibility();
        this._workspace.remove_transition('value');
        this._workspace.ease(params, {
            duration: WORKSPACE_SWITCH_TIME,
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
    _updateWorkspaceActors(showAnimation, from, to, hide = false) {
        this._animating = showAnimation;
        let workspaceManager = global.workspace_manager;
        let params = {};
            
        let active = to - from;
        (active > 0) ? active = 1 :  active = -1;

        if (showAnimation) {

            let isVertical = workspaceManager.layout_rows == -1;
            this._workspace.remove_all_transitions();

            if (isVertical)
                params.y = active * this._fullGeometry.height;
            else if (this.text_direction == Clutter.TextDirection.RTL)
                params.x = -active * this._fullGeometry.width;
            else
                params.x = active * this._fullGeometry.width;

            if (isVertical) {
                if (!hide) {
                    this._workspace.set(params);
                    params.y = 0;
                }
                if (this.isAnimationsEnabled) {
                    this.animateScroll(params);
                } else {
                    this._workspace.set(params);
                }
            } else {
                if (!hide) {
                    this._workspace.set(params);
                    params.x = 0;
                }
                if (this.isAnimationsEnabled) {
                    this.animateScroll(params);
                } else {
                    this._workspace.set(params);
                }
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

    _activeWorkspaceChanged(wm, from, to, direction) {
        if (this._scrolling)
            return;

        this._updateWorkspaceActors(true, from, to);
    }

    _onDestroy() {
        super._onDestroy();

        if (this._onScrollId)
            this._scrollAdjustment.disconnect(this._onScrollId);
        if (this._overviewShownId)
            Main.overview.disconnect(this._overviewShownId);
        if (this._switchWorkspaceNotifyId)
            global.window_manager.disconnect(this._switchWorkspaceNotifyId);
        let workspaceManager = global.workspace_manager;
        if (this._updateWorkspacesId)
            workspaceManager.disconnect(this._updateWorkspacesId);
        if (this._reorderWorkspacesId)
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
