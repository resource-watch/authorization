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
