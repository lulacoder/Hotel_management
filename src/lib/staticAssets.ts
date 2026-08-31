const STATIC_ASSET_ORIGIN =
  'https://Tripways-static-assets.leultesfaye0755.workers.dev'

const assetUrl = (fileName: string) => `${STATIC_ASSET_ORIGIN}/${fileName}`

export const staticAssets = {
  adventureLodge: assetUrl('adventure-lodge.webp'),
  appleTouchIcon: assetUrl('apple-touch-icon-v2.png'),
  boutiqueRoom: assetUrl('boutique-room.webp'),
  favicon: assetUrl('favicon-v2.ico'),
  hotelLobby: assetUrl('hotel-lobby.webp'),
  infinityPool: assetUrl('infinity-pool.webp'),
  logo: assetUrl('logo.webp'),
  logo32: assetUrl('logo32-v2.png'),
  logo192: assetUrl('logo192-v2.png'),
  logo512: assetUrl('logo512-v2.png'),
  mountainLodge: assetUrl('mountain-lodge.webp'),
  rusticSuite: assetUrl('rustic-suite.webp'),
  trifwaysLakesideHotel: assetUrl('trifways-lakeside-hotel.webp'),
} as const
