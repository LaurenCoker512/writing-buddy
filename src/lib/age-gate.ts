export function shouldShowAgeGate(explicitEnabled: boolean, rating: string): boolean {
  return rating === "E" && !explicitEnabled;
}
