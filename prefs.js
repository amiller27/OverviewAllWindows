const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GObject = imports.gi.GObject;
const Me = imports.misc.extensionUtils.getCurrentExtension();
const _ = imports.gettext.domain(Me.uuid).gettext;

// Import config
const config = Me.imports.config;

let settings;
function init() {
  imports.gettext.bindtextdomain(Me.uuid, Me.path + "/locale");
  const GioSSS = Gio.SettingsSchemaSource;

  let schemaSource = GioSSS.new_from_directory(Me.path + "/schemas", GioSSS.get_default(), false);

  let schemaObj = schemaSource.lookup(Me.metadata["settings-schema"], true);
  if (!schemaObj) {
    throw new Error("Schema " + Me.metadata["settings-schema"] + " could not be found for extension " +
      Me.uuid + ". Please check your installation.");
  }

  settings = new Gio.Settings({settings_schema : schemaObj});
}

function addSetting(vbox, label, tooltip, conf) {
  let hbox = new Gtk.Box({
    orientation : Gtk.Orientation.HORIZONTAL
  });

  let settingLabel = new Gtk.Label({
    label : _(label),
    xalign : 0
  });

  let settingSwitch = new Gtk.Switch();
  settings.bind(conf, settingSwitch, 'active', Gio.SettingsBindFlags.DEFAULT);
  settingLabel.set_tooltip_text(_(tooltip));
  settingSwitch.set_tooltip_text(_(tooltip));

  hbox.pack_start(settingLabel, true, true, 0);
  hbox.add(settingSwitch);

  vbox.add(hbox);
}



function buildPrefsWidget() {
  let vbox = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    margin: 10,
    margin_top: 15,
    spacing: 10
  });

  let label = "Replace overview? (Otherwise keybinding is <Super><Ctl>tab)";
  let tooltip = "Do you want to replace the overview?";
  addSetting(vbox, label, tooltip, config.SETTINGS_REPLACE_OVERVIEW);

  vbox.show_all();
  return vbox;
}
