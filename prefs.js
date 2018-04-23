const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const _ = imports.gettext.domain(Me.uuid).gettext;

const Convenience = Me.imports.convenience;

const SETTINGS_REPLACE_OVERVIEW = 'replace-overview';

function init() {
}

const OverviewAllWindowsPrefsWidget = new GObject.Class({
    Name: 'OverviewAllWindows.Prefs.Widget',
    GTypeName: 'OverviewAllWindowsPrefsWidget',
    Extends: Gtk.Grid,

    _init: function (params) {
        this.parent(params);
        this.margin = this.row_spacing = this.column_spacing = 10;
        this._settings = Convenience.getSettings();

        let label = "Replace overview? (Otherwise keybinding is <Super><Ctl>tab)";
        let tooltip = "Do you want to replace the overview?";
        this.addSetting(label, tooltip, SETTINGS_REPLACE_OVERVIEW);
    },

    addSetting: function (label, tooltip, conf) {
        let settingSwitch = new Gtk.Switch({
            active: this._settings.get_boolean(conf)
        });
        settingSwitch.set_tooltip_text(_(tooltip));

        this._settings.bind(
            conf,
            settingSwitch,
            'active',
            Gio.SettingsBindFlags.DEFAULT);

        let settingLabel = new Gtk.Label({
            label : _(label),
            hexpand: true,
            halign: Gtk.Align.START
        });
        settingLabel.set_line_wrap(true);
        settingLabel.set_tooltip_text(_(tooltip));

        this.attach(settingLabel, 0, 0, 1, 1);
        this.attach(settingSwitch, 1, 0, 1, 1);
    }
});

function buildPrefsWidget() {
    let widget = new OverviewAllWindowsPrefsWidget();
    widget.show_all();
    return widget;
}
