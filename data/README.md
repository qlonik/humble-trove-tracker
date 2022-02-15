# Humble Trove data

This folder contains some historical data and some data collected from the
Humble Bundle api right before the endpoint was made inaccessible.

## Historical humble trove data

Lots of data is unavailable since we started collecting snapshots very late.
However, some historical data is available from
https://www.steamgifts.com/discussion/FqdzR/humble-choice-humble-trove-updated-june-2021

The data in `existing-on-2021.06.json` and `removed-on-2021.06.json` is
collected and cleaned up from this website.

## Collected snapshots

Only a handful of snapshots was collected from the HumbleBundle API. Each of the
snapshot files is a rather large file, with only a small number of changes as
compared to the previous snapshot. Because of that, only the last collected
snapshot is kept as a full JSON object. It is available in
`snapshot-1643806333012.json` file.

All the previous snapshot files can be reconstructed from the latest using the 2
available patch files. The patch files will produce snapshots in a backwards
order from the latest snapshot. So, using the first patch
`patches/diff_1_1643806333012_to_1643201517123.patch` will produce second to
last snapshot and so on. Note that the `patch` command will modify the file that
is being patched in-place. In order to produce the previous snapshot, you can
use the following command:

```shell
patch snapshot-1643806333012.json patches/diff_1_1643806333012_to_1643201517123.patch
```

## Finalized information

Since Trove API endpoint is no longer accessible, no new data is going to be
added. So, all the relevant data to display the website page is collected in
`finalized-information.json` file. The data is already pre-sorted in the order
of the latest available game.
