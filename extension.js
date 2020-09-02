const Main = imports.ui.main;
const Workspace = imports.ui.workspace;
const WorkspacesView = imports.ui.workspacesView;
const Shell = imports.gi.Shell;
const Meta = imports.gi.Meta;
const ExtensionUtils = imports.misc.extensionUtils;

const Me = imports.misc.extensionUtils.getCurrentExtension();
const Prefs = Me.imports.prefs;
const UnifiedWorkspacesView = Me.imports.unifiedWorkspacesView;

let originalWorkspacesView;
let is_setup = false;
let is_setting_up = false;
let settings = 0;
let _overviewHiddenId = 0;
let last_setting = 0;
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
}

function enable() {
    // log('OverviewAllWindows enable');
    settings = ExtensionUtils.getSettings();
    signals.push(settings.connect('changed::' +
            Prefs.SETTINGS_REPLACE_OVERVIEW, checkSettings));
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
    destroy();
}

function setUp() {
    if (is_setup||is_setting_up) return;
    is_setting_up = true;

    originalWorkspacesView = WorkspacesView.WorkspacesView;
    WorkspacesView.WorkspacesView = UnifiedWorkspacesView.UnifiedWorkspacesView;

    Main.overview.viewSelector._workspacesDisplay._updateWorkspacesViews();

    is_setup = true;
    is_setting_up = false;
}

function destroy() {
    // log('OverviewAllWindows destroy');
    if (!is_setup||is_setting_up) return;
    is_setting_up = true;

    WorkspacesView.WorkspacesView = originalWorkspacesView;
    Main.overview.viewSelector._workspacesDisplay._updateWorkspacesViews();

    if (_overviewHiddenId != 0) {
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
