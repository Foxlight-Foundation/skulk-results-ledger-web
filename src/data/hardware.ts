/**
 * Return whether every class in a hardware profile identifies real hardware.
 * Empty profiles and partial profiles such as `AMD 128GB + unknown` are not
 * comparable benchmark contexts and must not feed dashboard data.
 */
export function hasFullyKnownHardware(classes: readonly string[]): boolean {
  return (
    classes.length > 0 &&
    classes.every((hardwareClass) => !hardwareClass.startsWith('unknown'))
  );
}
