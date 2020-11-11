'use strict';
const { Meta, Shell } = imports.gi;
const Main = imports.ui.main;
const Workspace = imports.ui.workspace;
const WorkspacesView = imports.ui.workspacesView;

const ExtensionUtils = imports.misc.extensionUtils;

const Me = ExtensionUtils.getCurrentExtension();
const Prefs = Me.imports.prefs;
const UnifiedWorkspace = Me.imports.workspace;
const UnifiedWorkspacesView = Me.imports.unifiedWorkspacesView;

let originalWorkspacesView;
let originalFunctions = {};
let is_setup = false;
let is_setting_up = false;
let settings = null;
let _overviewHiddenId = 0;
let last_setting = null;
let signals = [];
let keybindings = [];


function init() {
    // log('OverviewAllWindows init');
}

function _addKeybinding(name, handler) {
    if (Main.wm.addKeybinding) {
        let ModeType = Shell.hasOwnProperty('ActionMode')
                     ? Shell.ActionMode
                     : Shell.KeyBindingMode;
        Main.wm.addKeybinding(name,
                              settings,
                              Meta.KeyBindingFlags.NONE,
                              ModeType.NORMAL | ModeType.OVERVIEW, handler);
    } else {
        global.display.add_keybinding(name,
                                      settings,
                                      Meta.KeyBindingFlags.NONE,
                                      handler);
    }
}

function _removeKeybindings(name) {
    if (Main.wm.removeKeybinding) {
        Main.wm.removeKeybinding(name);
    }
    else {
        global.display.remove_keybinding(name);
    }
}

function checkSettings() {
    let new_setting = settings.get_boolean(Prefs.SETTINGS_REPLACE_OVERVIEW);
    // log('OverviewAllWindows checkSettings | new_setting: ' + new_setting);
    if (new_setting === last_setting) {
        return;
    }

    if (new_setting) {
        while (keybindings.length) {
            _removeKeybindings(keybindings.pop());
        }
        setUp();
    } else {
        destroy();
        keybindings.push('toggle-unified-overview');
        _addKeybinding('toggle-unified-overview', toggleUnifiedOverview);
    }

    last_setting = new_setting;
}

function enable() {
    // log('OverviewAllWindows enable');
    settings = ExtensionUtils.getSettings();
    signals.push(settings.connect(
        'changed::' + Prefs.SETTINGS_REPLACE_OVERVIEW,
        checkSettings));
    checkSettings();
}

function disable() {
    // log('OverviewAllWindows disable');
    while (signals.length) {
        settings.disconnect(signals.pop());
    }

    while (keybindings.length) {
        _removeKeybindings(keybindings.pop());
    }

    if (is_setup) destroy();
}

function setUp() {
    if (is_setup||is_setting_up) return;
    is_setting_up = true;

    for (let functionName of UnifiedWorkspace.replacedFunctions) {
        originalFunctions[functionName] =
            Workspace.Workspace[functionName];
        Workspace.Workspace[functionName] =
            UnifiedWorkspace[functionName];
    }

    originalWorkspacesView = WorkspacesView.WorkspacesView;
    WorkspacesView.WorkspacesView = UnifiedWorkspacesView.UnifiedWorkspacesView;

    Main.overview.viewSelector._workspacesDisplay._updateWorkspacesViews();

    is_setup = true;
    is_setting_up = false;
}

function destroy() {
    // log('OverviewAllWindows destroy');
    if (!is_setup || is_setting_up) return;
    is_setting_up = true;

    if (originalFunctions.length) {
        for (let functionName in originalFunctions) {
            Workspace.Workspace[functionName] =
                originalFunctions[functionName];
        }
        originalFunctions = {};
    }

    if (originalWorkspacesView) {
        WorkspacesView.WorkspacesView = originalWorkspacesView;
        Main.overview.viewSelector._workspacesDisplay._updateWorkspacesViews();
        originalWorkspacesView = null;
    }

    if (_overviewHiddenId) {
        Main.overview.disconnect(_overviewHiddenId);
        _overviewHiddenId = 0;
    }

    is_setup = false;
    is_setting_up = false;
}

function toggleUnifiedOverview() {
    if (Main.overview.visible) {
        Main.overview.hide();
    } else {
        setUp();
        Main.overview.show();
        _overviewHiddenId = Main.overview.connect('hidden', destroy);
    }
}
