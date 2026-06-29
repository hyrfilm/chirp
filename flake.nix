{
  description = "Chirp — mini social feed: development and skivvy API-test environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs =
    { self, nixpkgs }:
    let
      systems = [
        "aarch64-darwin"
        "x86_64-darwin"
        "aarch64-linux"
        "x86_64-linux"
      ];
      forAllSystems =
        f: nixpkgs.lib.genAttrs systems (system: f (import nixpkgs { inherit system; }));
    in
    {
      devShells = forAllSystems (pkgs: {
        default = pkgs.mkShell {
          packages = [
            # Node 24 is required: the scripts run TypeScript directly
            # (`node scripts/*.ts`) and use process.loadEnvFile().
            pkgs.nodejs_24
            pkgs.bun

            # skivvy is a Python CLI not packaged in nixpkgs, so we pin Python
            # and uv and expose a `skivvy` wrapper that runs it via uvx. uvx
            # fetches and caches skivvy on first use.
            pkgs.python3
            pkgs.uv
            (pkgs.writeShellScriptBin "skivvy" ''
              exec uvx skivvy "$@"
            '')

            # Handy for poking at the API and the dockerised Postgres.
            pkgs.curl
            pkgs.jq
            pkgs.postgresql_18
          ];

          shellHook = ''
            echo "chirp dev shell"
            echo "  node $(node --version)  bun $(bun --version)  uv $(uv --version | cut -d' ' -f2)"
            echo
            echo "  npm run dev      start Next.js (http://localhost:3000)"
            echo "  skivvy <path>    run skivvy API tests (via uvx)"
            echo
          '';
        };
      });
    };
}
