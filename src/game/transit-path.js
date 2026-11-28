// Zpomalení, podle kterého linkové vozy plánují běžné zastavení (m/s²).
export const TRANSIT_STOP_DECELERATION = 1.35;

// Poloha a natočení článku vychází z obou náprav i při průjezdu obloukem.
export function sectionPose(route, center, side, axle, front, rear, out) {
  route.posAt(center + axle, side, front);
  route.posAt(center - axle, side, rear);
  out.x = (front.x + rear.x) / 2;
  out.z = (front.z + rear.z) / 2;
  out.yaw = Math.atan2(front.x - rear.x, front.z - rear.z);
}
