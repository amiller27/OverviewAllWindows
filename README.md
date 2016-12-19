OverviewAllWindows
==================

This repository contains an extension for the GNOME desktop environment which provides the option for the user to display windows from all workspaces when in overview mode.  Rather than scrolling through workspaces to view windows for each workspace separately, the user can view all open or minimized windows at once.

If you have Gnome-Shell installed, you can get the extension [here](https://extensions.gnome.org/extension/873/overview-all-windows/).

Development
===========
If you change the schema xml, be sure to run

`glib-compile-schemas ./schemas`

and commit

`gschemas.compiled`

as well.
