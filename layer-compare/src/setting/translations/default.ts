import runtime from '../../runtime/translations/default'
export default {
  ...runtime,
  mapSection: 'Map',
  selectMap: 'Select a Map widget',
  optionsSection: 'Comparison options',
  startPosition: 'Initial divider position (%)',
  allowContextToggle: 'Allow users to show other visible map layers',
  startContext: 'Initially show other visible layers on both sides',
  showHelp: 'Show Help and the first-run hint',
  startLabel: 'First side label (optional)',
  endLabel: 'Second side label (optional)',
  labelsHint: 'Leave labels empty to use Left / Right or Top / Bottom in the layer list automatically.',
  availableSection: 'Available layers',
  availabilityHint: 'Choose which map layers users can compare. Layers hidden by the map layer-list settings stay hidden here.',
  defaultSection: 'Default selections (optional)',
  defaultsHint: 'Choose any starting layers for each side. Comparison stays off until the user selects Start comparison.',
  previewMap: 'Connect a 2D Map widget and open that map in the builder to choose available layers and defaults.',
  telemetrySection: 'Usage telemetry',
  telemetryLabel: 'Enable the shared usage telemetry',
  telemetryHint: 'Uses the same shared telemetry module as the other custom widgets. No events are sent unless this organization has configured a telemetry destination.',
  settingLoadError: 'Map layers could not be read. Open the map in the builder and try Refresh layers.'
}
