import config from 'config';

export interface IApplication {
    name: string;
    logo: string;
    principalColor: string;
}

interface IFacebookAuth {
    scope: string[];
    clientSecret: string;
    clientID: string;
    active: boolean;
}

interface IGoogleAuth {
    scope: string[];
    clientSecret: string;
    clientID: string;
    active: boolean;
}

interface ITwitterAuth {
    consumerSecret: string;
    consumerKey: string;
    active: boolean;
}

interface IAppleAuth {
    active: boolean;
    teamId: string;
    keyId: string;
    clientId: string;
    privateKeyString: string;
}

interface IJwtAuth {
    expiresInMinutes: number;
    secret: string;
    active: boolean;
}

export interface IThirdPartyAuth {
    facebook: IFacebookAuth;
    google: IGoogleAuth;
    apple?: IAppleAuth;
    twitter: ITwitterAuth;
}

export interface ISettings {
    applications: Record<string, IApplication>;
    publicUrl: string;
    jwt: IJwtAuth;
    defaultApp: string;
    thirdParty: Record<string, IThirdPartyAuth>;
}

export default class Settings {
    private static settings: ISettings = null;

    static getSettings(): ISettings {
        if (Settings.settings && process.env.NODE_ENV !== 'test') {
            return Settings.settings;
        }

        Settings.settings = {
            applications: {
                rw: {
                    name: 'RW API',
                    logo: 'https://resourcewatch.org/static/images/logo-embed.png',
                    principalColor: '#c32d7b',
                },
                prep: {
                    name: 'PREP',
                    logo: 'https://prepdata.org/prep-logo.png',
                    principalColor: '#263e57',
                },
                gfw: {
                    name: 'Global Forest Watch',
                    logo: 'data:image/png;base64,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',
                    principalColor: '#97be32',
                },
                'forest-atlas': {
                    name: 'Forest Atlas',
                    logo: 'https://wriorg.s3.amazonaws.com/s3fs-public/styles/large/public/forest-atlases-logo-1.png?itok=BV_4QvsM',
                    principalColor: '#008d6a',
                },
                gnw: {
                  name: 'Global Nature Watch',
                  logo: 'data:image/png;base64,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',
                  principalColor: '#0141B1',
                }
            },
            jwt: {
                expiresInMinutes: 0.0,
                secret: config.get('jwt.token'),
                active: true
            },
            publicUrl: config.get('server.publicUrl'),
            defaultApp: config.get('settings.defaultApp'),
            thirdParty: {
                rw: {
                    facebook: {
                        scope: ['email'],
                        clientSecret: config.get('settings.thirdParty.rw.facebook.clientSecret'),
                        clientID: config.get('settings.thirdParty.rw.facebook.clientID'),
                        active: (
                            config.get('settings.thirdParty.rw.facebook.active') &&
                            config.get('settings.thirdParty.rw.facebook.clientSecret') &&
                            config.get('settings.thirdParty.rw.facebook.clientID')
                        )
                    },
                    google: {
                        scope: [
                            'https://www.googleapis.com/auth/plus.me',
                            'https://www.googleapis.com/auth/userinfo.email'
                        ],
                        clientSecret: config.get('settings.thirdParty.rw.google.clientSecret'),
                        clientID: config.get('settings.thirdParty.rw.google.clientID'),
                        active: (
                            config.get('settings.thirdParty.rw.google.active') &&
                            config.get('settings.thirdParty.rw.google.clientSecret') &&
                            config.get('settings.thirdParty.rw.google.clientID')
                        )
                    },
                    twitter: {
                        consumerSecret: config.get('settings.thirdParty.rw.twitter.consumerSecret'),
                        consumerKey: config.get('settings.thirdParty.rw.twitter.consumerKey'),
                        active: (
                            config.get('settings.thirdParty.rw.twitter.active') &&
                            config.get('settings.thirdParty.rw.twitter.consumerSecret') &&
                            config.get('settings.thirdParty.rw.twitter.consumerKey')
                        )
                    }
                },
                gfw: {
                    facebook: {
                        scope: ['email'],
                        clientSecret: config.get('settings.thirdParty.gfw.facebook.clientSecret'),
                        clientID: config.get('settings.thirdParty.gfw.facebook.clientID'),
                        active: (
                            config.get('settings.thirdParty.gfw.facebook.active') &&
                            config.get('settings.thirdParty.gfw.facebook.clientSecret') &&
                            config.get('settings.thirdParty.gfw.facebook.clientID')
                        )
                    },
                    google: {
                        scope: [
                            'https://www.googleapis.com/auth/plus.me',
                            'https://www.googleapis.com/auth/userinfo.email'
                        ],
                        clientSecret: config.get('settings.thirdParty.gfw.google.clientSecret'),
                        clientID: config.get('settings.thirdParty.gfw.google.clientID'),
                        active: (
                            config.get('settings.thirdParty.gfw.google.active') &&
                            config.get('settings.thirdParty.gfw.google.clientSecret') &&
                            config.get('settings.thirdParty.gfw.google.clientID')
                        )
                    },
                    apple: {
                        active: (
                            config.get('settings.thirdParty.gfw.apple.active') &&
                            config.get('settings.thirdParty.gfw.apple.teamId') &&
                            config.get('settings.thirdParty.gfw.apple.keyId') &&
                            config.get('settings.thirdParty.gfw.apple.clientId') &&
                            config.get('settings.thirdParty.gfw.apple.privateKeyString')
                        ),
                        teamId: config.get('settings.thirdParty.gfw.apple.teamId'),
                        keyId: config.get('settings.thirdParty.gfw.apple.keyId'),
                        clientId: config.get('settings.thirdParty.gfw.apple.clientId'),
                        privateKeyString: config.get('settings.thirdParty.gfw.apple.privateKeyString')
                    },
                    twitter: {
                        consumerSecret: config.get('settings.thirdParty.gfw.twitter.consumerSecret'),
                        consumerKey: config.get('settings.thirdParty.gfw.twitter.consumerKey'),
                        active: (
                            config.get('settings.thirdParty.gfw.twitter.active') &&
                            config.get('settings.thirdParty.gfw.twitter.consumerSecret') &&
                            config.get('settings.thirdParty.gfw.twitter.consumerKey')
                        )
                    }
                },
                prep: {
                    facebook: {
                        scope: ['email'],
                        clientSecret: config.get('settings.thirdParty.prep.facebook.clientSecret'),
                        clientID: config.get('settings.thirdParty.prep.facebook.clientID'),
                        active: (
                            config.get('settings.thirdParty.prep.facebook.active') &&
                            config.get('settings.thirdParty.prep.facebook.clientSecret') &&
                            config.get('settings.thirdParty.prep.facebook.clientID')

                        )
                    },
                    google: {
                        scope: [
                            'https://www.googleapis.com/auth/plus.me',
                            'https://www.googleapis.com/auth/userinfo.email'
                        ],
                        clientSecret: config.get('settings.thirdParty.prep.google.clientSecret'),
                        clientID: config.get('settings.thirdParty.prep.google.clientID'),
                        active: (
                            config.get('settings.thirdParty.prep.google.active') &&
                            config.get('settings.thirdParty.prep.google.clientSecret') &&
                            config.get('settings.thirdParty.prep.google.clientID')
                        )
                    },
                    twitter: {
                        consumerSecret: config.get('settings.thirdParty.prep.twitter.consumerSecret'),
                        consumerKey: config.get('settings.thirdParty.prep.twitter.consumerKey'),
                        active: (
                            config.get('settings.thirdParty.prep.twitter.active') &&
                            config.get('settings.thirdParty.prep.twitter.consumerSecret') &&
                            config.get('settings.thirdParty.prep.twitter.consumerKey')
                        )
                    }
                },
                gnw: {
                  facebook: {
                      scope: ['email'],
                      clientSecret: config.get('settings.thirdParty.prep.facebook.clientSecret'),
                      clientID: config.get('settings.thirdParty.prep.facebook.clientID'),
                      active: (
                          config.get('settings.thirdParty.prep.facebook.active') &&
                          config.get('settings.thirdParty.prep.facebook.clientSecret') &&
                          config.get('settings.thirdParty.prep.facebook.clientID')

                      )
                  },
                  google: {
                      scope: [
                          'https://www.googleapis.com/auth/plus.me',
                          'https://www.googleapis.com/auth/userinfo.email'
                      ],
                      clientSecret: config.get('settings.thirdParty.prep.google.clientSecret'),
                      clientID: config.get('settings.thirdParty.prep.google.clientID'),
                      active: (
                          config.get('settings.thirdParty.prep.google.active') &&
                          config.get('settings.thirdParty.prep.google.clientSecret') &&
                          config.get('settings.thirdParty.prep.google.clientID')
                      )
                  },
                  twitter: {
                      consumerSecret: config.get('settings.thirdParty.prep.twitter.consumerSecret'),
                      consumerKey: config.get('settings.thirdParty.prep.twitter.consumerKey'),
                      active: (
                          config.get('settings.thirdParty.prep.twitter.active') &&
                          config.get('settings.thirdParty.prep.twitter.consumerSecret') &&
                          config.get('settings.thirdParty.prep.twitter.consumerKey')
                      )
                  }
              }
            }
        };

        return Settings.settings;
    }
}
