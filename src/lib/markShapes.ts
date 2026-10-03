/**
 * The one place the mark's geometry lives, in a 64×64 square.
 *
 * A lit screen with a cue mark burned into its corner, and two heads in front of it. The heads
 * lean to one side and sit close together rather than squarely apart, because two people at the
 * cinema sit next to each other — centred and evenly spaced, they read as a perforated ticket.
 */
export const SCREEN = { x: 8, y: 13, width: 48, height: 31, rx: 3 } as const;

/** The cue mark a projectionist watches for: a ring, not a dot, high in the far corner. */
export const CUE = { cx: 47.5, cy: 21.5, r: 4, strokeWidth: 2.4 } as const;

/** Half-ellipses rising from below the screen's lower edge, so they carry on into the room. */
export const HEADS = [
  "M12.9 50a6.6 12 0 0 1 13.2 0Z",
  "M27.6 50a6.6 12 0 0 1 13.2 0Z",
] as const;
