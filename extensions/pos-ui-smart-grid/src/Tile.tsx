import React from 'react';
import { Tile, reactExtension, useApi } from '@shopify/ui-extensions-react/point-of-sale';

function TileComponent() {
  const api = useApi<'pos.home.tile.render'>();

  return (
    <Tile
      title="Appointments"
      subtitle="Barbify"
      onPress={() => {
        api.action.presentModal();
      }}
      enabled
    />
  );
}

export default reactExtension('pos.home.tile.render', () => <TileComponent />);