export type BrandName =
  | "google"
  | "discord"
  | "github"
  | "telegram"
  | "steam"
  | "riotgames"
  | "valorant";

const files: Record<BrandName, string> = {
  google: "/brands/google.svg",
  discord: "/brands/discord.svg",
  github: "/brands/github.svg",
  telegram: "/brands/telegram.svg",
  steam: "/brands/steam.svg",
  riotgames: "/brands/riotgames.svg",
  valorant: "/brands/valorant.svg",
};

export default function BrandIcon({
  brand,
  className,
  size = 22,
}: {
  brand: BrandName;
  className?: string;
  size?: number;
}) {
  return (
    <img
      alt=""
      aria-hidden="true"
      className={className}
      height={size}
      src={files[brand]}
      width={size}
    />
  );
}
