const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

module.exports = {
  packagerConfig: {
    asar: true,
    name: 'MN-GPT',
    productName: 'MN-GPT',
    icon: 'src/assets/logo',
    // Uncomment below for macOS signing (optional)
    // osxSign: {
    //   identity: 'Developer ID Application',
    //   hardened-runtime: true,
    // },
    // osxNotarize: {
    //   appleId: 'your-apple-id@example.com',
    //   appleIdPassword: 'app-specific-password',
    //   teamId: 'your-team-id',
    // },
  },
  rebuildConfig: {},
  makers: [
    // Windows Installer
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'mn-gpt',
        productName: 'MN-GPT',
        shortcutName: 'MN-GPT',
        authors: 'Rocky Balbo',
        description: 'MN-AI Desktop Assistant - Interview Preparation Tool',
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
      },
    },
    // macOS DMG
    {
      name: '@electron-forge/maker-dmg',
      config: {
        format: 'ULFO',
        name: 'MN-GPT',
      },
      platforms: ['darwin'],
    },
    // macOS ZIP (alternative to DMG)
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    // Linux DEB (Debian/Ubuntu)
    {
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          name: 'mn-gpt',
          productName: 'MN-GPT',
          genericName: 'Interview Assistant',
          description: 'AI-powered interview preparation and learning assistant',
          categories: ['Development', 'Education'],
          icon: 'src/assets/logo.png',
          maintainer: 'Rocky Balbo <rockybalbo1991@example.com>',
          homepage: 'https://github.com/rockybalbo1991/mn-gpt',
        },
      },
    },
    // Linux RPM (Red Hat/Fedora/CentOS)
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          name: 'mn-gpt',
          productName: 'MN-GPT',
          genericName: 'Interview Assistant',
          description: 'AI-powered interview preparation and learning assistant',
          categories: ['Development', 'Education'],
          icon: 'src/assets/logo.png',
          homepage: 'https://github.com/rockybalbo1991/mn-gpt',
        },
      },
    },
    // AppImage for Linux (portable)
    {
      name: '@electron-forge/maker-appimage',
      platforms: ['linux'],
      config: {
        options: {
          name: 'MN-GPT',
          productName: 'MN-GPT',
          genericName: 'Interview Assistant',
          description: 'AI-powered interview preparation and learning assistant',
          categories: ['Development', 'Education'],
          icon: 'src/assets/logo.png',
          homepage: 'https://github.com/rockybalbo1991/mn-gpt',
        },
      },
    },
  ],
  plugins: [
    // Auto unpack native modules
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Security fuses - prevent code tampering and vulnerabilities
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  publishers: [
    // Optional: Uncomment to auto-publish releases to GitHub
    // {
    //   name: '@electron-forge/publisher-github',
    //   config: {
    //     repository: {
    //       owner: 'rockybalbo1991',
    //       name: 'mn-gpt',
    //     },
    //     prerelease: false,
    //     draft: true,
    //   },
    // },
  ],
};
