# Configure

A key feature of MMGIS is that it's Multi-Mission and thus configurable. The configuration page is where you can create new missions and add tools and layers to your mission. A mission named `Test` is included as a sample so that you can view how it was configured. To enable it, create a new mission named "Test".

## Getting Started

#### Navigating to Configure

The configuration in accessible through the browser by appending `configure` to the page's URL like so:

`https://path-to-MMGIS/configure`

Login in with your admin account. If this is your first visit to the page, sign up for an admin account and then re-enter the credentials.

#### Navigation Panel

When first opening the page, it'll be mostly blank except for a title and a navigation panel.

- The first button in the navigation bar is named `New Mission` which opens a tab that enables you to create a new mission.
- All the buttons below correspond to a preexisting missions. Clicking on one opens up the configurations tabs for that mission.
- At the very bottom are additional pages that manage datasets that can be stored in the database.

#### Creating a New Mission

Missions can be thought of as separate instances of MMGIS. If there is more than one mission configured, a landing page will enable the selection of them.

1. Click on `New Mission`
1. Enter a Mission Name (this cannot match any preexisting mission names)
1. By default, a templated mission directory will be created in the `Missions` folder. If you'd rather not have this happen, uncheck the option. Relative URLs will still default there though.
1. Click `Make Mission`

You should see a success message and the page should reload. The reloaded page should now show your mission in the navigation panel and be accessible through the landing page or by going to `https://path-to-MMGIS/?mission=[new mission name]` or, if it's the only mission, at `https://path-to-MMGIS`.

## Configuring A Mission

Once you select a mission, you'll be presented with a view with tabs at the top. Each tab modifies some aspect of MMGIS is explained in detail in its corresponding documentation page.

## Saving Changes

To save changes, click `Save Changes` at the bottom right.

If all went well, it should say `Save Successful`. If not, explanations will pop up in the top right.

_If you switch missions tabs or close the page before saving, your changes will be lost!_
