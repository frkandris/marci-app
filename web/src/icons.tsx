/**
 * Saját, lapos (flat) ikonkészlet.
 *
 * Miért nem ikonkönyvtár CDN-ről: a PWA-nak önhordónak kell lennie (offline
 * betöltés, szigorú origin), és egy teljes készletből úgyis 15 ikont
 * használnánk. Miért nem emoji: platformonként más a rajzuk, a méretük és a
 * színük, ezért a felület sosem néz ki egységesnek.
 *
 * Minden ikon 24×24 rácson, tömör kitöltéssel, `currentColor`-ral — így a
 * szövegszínt veszi fel, és bárhol használható.
 */

export const ICON_NAMES = [
  'moon',
  'bed',
  'bowl',
  'bottle',
  'droplet',
  'blocks',
  'sun',
  'shoe',
  'backpack',
  'car',
  'book',
  'music',
  'heart',
  'health',
  'star',
  'stop',
  // Fülikonok — nem választhatók tevékenységhez, de ugyanabból a készletből.
  'record',
  'list',
  'grid',
  'sliders',
] as const;

export type IconName = (typeof ICON_NAMES)[number];

const PATHS: Record<IconName, string> = {
  // hold
  moon: 'M20.3 14.6A8.6 8.6 0 0 1 9.4 3.7a1 1 0 0 0-1.3-1.2 10.6 10.6 0 1 0 13.4 13.4 1 1 0 0 0-1.2-1.3z',
  // ágy
  bed: 'M3 7a1 1 0 0 1 2 0v4h14a3 3 0 0 1 3 3v5a1 1 0 0 1-2 0v-2H4v2a1 1 0 0 1-2 0V7zm5 1a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5z',
  // tál + kanál
  bowl: 'M3 10h14a1 1 0 0 1 1 1 8 8 0 0 1-16 0 1 1 0 0 1 1-1zm18-7a1 1 0 0 1 1 1v6a1 1 0 0 1-2 0V9h-1a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h2z',
  // cumisüveg
  bottle: 'M10 2h4a1 1 0 0 1 0 2v1.2l1.4 1.4A3 3 0 0 1 16 8.7V20a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8.7a3 3 0 0 1 .6-1.8L10 5.2V4a1 1 0 0 1 0-2zm0 8h4a1 1 0 0 1 0 2h-4a1 1 0 0 1 0-2zm0 4h4a1 1 0 0 1 0 2h-4a1 1 0 0 1 0-2z',
  // csepp
  droplet: 'M12 2.2c.3 0 .6.1.8.4C15 5 19 10 19 13.9A7 7 0 0 1 5 14c0-4 4-9 6.2-11.4.2-.3.5-.4.8-.4z',
  // építőkockák
  blocks: 'M3 4h7v7H3V4zm11 0h7v7h-7V4zM3 13h7v7H3v-7zm11 0h7v7h-7v-7z',
  // nap
  sun: 'M12 7.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zM12 1a1 1 0 0 1 1 1v2a1 1 0 0 1-2 0V2a1 1 0 0 1 1-1zm0 18a1 1 0 0 1 1 1v2a1 1 0 0 1-2 0v-2a1 1 0 0 1 1-1zM1 12a1 1 0 0 1 1-1h2a1 1 0 0 1 0 2H2a1 1 0 0 1-1-1zm18 0a1 1 0 0 1 1-1h2a1 1 0 0 1 0 2h-2a1 1 0 0 1-1-1zM4.2 4.2a1 1 0 0 1 1.4 0l1.5 1.5a1 1 0 0 1-1.4 1.4L4.2 5.6a1 1 0 0 1 0-1.4zm12.7 12.7a1 1 0 0 1 1.4 0l1.5 1.5a1 1 0 0 1-1.4 1.4l-1.5-1.5a1 1 0 0 1 0-1.4zm2.9-12.7a1 1 0 0 1 0 1.4l-1.5 1.5a1 1 0 0 1-1.4-1.4l1.5-1.5a1 1 0 0 1 1.4 0zM7.1 16.9a1 1 0 0 1 0 1.4l-1.5 1.5a1 1 0 0 1-1.4-1.4l1.5-1.5a1 1 0 0 1 1.4 0z',
  // cipő
  shoe: 'M2 12a1 1 0 0 1 1-1h3l2.6 1.7a2 2 0 0 0 1.7.3l3.1-.9a2 2 0 0 1 1.9.4l4.4 3.6a3 3 0 0 1 1.1 2.3V19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-7zm2-4a1 1 0 0 1 1-1h1a1 1 0 0 1 .8.4l1.7 2.3-1.9-.7H3l1-1z',
  // hátizsák
  backpack: 'M9 2h6a1 1 0 0 1 1 1v1.3A6 6 0 0 1 20 10v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-9a6 6 0 0 1 4-5.7V3a1 1 0 0 1 1-1zm-1 9v3a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-3H8zm2-7h4V4h-4v0z',
  // autó
  car: 'M5.1 10l1.5-4.2A2 2 0 0 1 8.5 4.5h7a2 2 0 0 1 1.9 1.3L18.9 10h1.1a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1.2a2.5 2.5 0 0 1-4.6 0H9.8a2.5 2.5 0 0 1-4.6 0H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h1.1zm2.1 0h9.6l-1.1-3.1a.5.5 0 0 0-.5-.4H8.8a.5.5 0 0 0-.5.4L7.2 10zM7.5 15a1 1 0 1 0 0 2 1 1 0 0 0 0-2zm9 0a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
  // nyitott könyv (meseolvasás) — két jól elkülönülő lap, középen réssel
  book: 'M2.4 5.1c0-.7.6-1.2 1.3-1.1a16 16 0 0 1 6.6 2.3c.4.2.6.7.6 1.1v11.9c0 .9-1 1.4-1.7 1a13 13 0 0 0-5.7-1.7c-.6 0-1.1-.5-1.1-1.2V5.1zm11.1 2.3c0-.4.2-.9.6-1.1a16 16 0 0 1 6.6-2.3c.7-.1 1.3.4 1.3 1.1v12.3c0 .7-.5 1.2-1.1 1.2a13 13 0 0 0-5.7 1.7c-.7.4-1.7-.1-1.7-1V7.4z',
  // hangjegy
  music: 'M20 3.2a1 1 0 0 1 .8 1V16a4 4 0 1 1-2-3.4V7.6l-8 1.8V18a4 4 0 1 1-2-3.4V6.8a1 1 0 0 1 .8-1l10.4-2.6z',
  // szív
  heart: 'M12 21s-8.4-4.9-9.7-10.2A5.7 5.7 0 0 1 12 6.3a5.7 5.7 0 0 1 9.7 4.5C20.4 16.1 12 21 12 21z',
  // egészség / kereszt
  health: 'M9 2h6a1 1 0 0 1 1 1v5h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-5v5a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-5H3a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1h5V3a1 1 0 0 1 1-1z',
  // csillag
  star: 'M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.3l6.5-.9L12 2.5z',
  // stop
  stop: 'M6 5h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  // stopper (Most fül) — a mérés a téma, nem a "felvétel"
  record: 'M9.5 1.5h5a1 1 0 0 1 0 2h-1.5v1.55a8.5 8.5 0 0 1 4 1.66l1.1-1.11a1 1 0 1 1 1.42 1.42l-1.11 1.1A8.5 8.5 0 1 1 11 5.05V3.5H9.5a1 1 0 0 1 0-2zM12 8.5a1 1 0 0 0-1 1v4.1a1 1 0 0 0 .45.83l2.6 1.74a1 1 0 1 0 1.1-1.66L13 13.07V9.5a1 1 0 0 0-1-1z',
  // lista (Nap fül)
  list: 'M4 5.5h2.5v2.5H4V5.5zm4.5 0H20a1 1 0 0 1 0 2H8.5a1 1 0 0 1 0-2zM4 10.8h2.5v2.5H4v-2.5zm4.5 0H20a1 1 0 0 1 0 2H8.5a1 1 0 0 1 0-2zM4 16h2.5v2.5H4V16zm4.5 0H20a1 1 0 0 1 0 2H8.5a1 1 0 0 1 0-2z',
  // rács (Napok fül)
  grid: 'M3 4.5h18a1 1 0 0 1 0 2H3a1 1 0 0 1 0-2zm0 4.5h12a1 1 0 0 1 0 2H3a1 1 0 0 1 0-2zm0 4.5h18a1 1 0 0 1 0 2H3a1 1 0 0 1 0-2zm0 4.5h9a1 1 0 0 1 0 2H3a1 1 0 0 1 0-2z',
  // szabályzók (Típusok fül)
  sliders: 'M4 6h8a1 1 0 0 1 0 2H4a1 1 0 0 1 0-2zm12.5-2.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM4 16h4a1 1 0 0 1 0 2H4a1 1 0 0 1 0-2zm8.5-2.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM17 16h3a1 1 0 0 1 0 2h-3a1 1 0 0 1 0-2zm-5-10h8a1 1 0 0 1 0 2h-8a1 1 0 0 1 0-2z',
};

const isIconName = (v: unknown): v is IconName =>
  typeof v === 'string' && (ICON_NAMES as readonly string[]).includes(v);

export function Icon({
  name,
  size = 20,
  className,
}: {
  name: string | null | undefined;
  size?: number;
  className?: string;
}) {
  const key: IconName = isIconName(name) ? name : 'star';
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[key]} />
    </svg>
  );
}
