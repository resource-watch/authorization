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
                    logo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALQAAAC0CAMAAAAKE/YAAAAB+1BMVEWXvT2jxVTF2pLl78/5+/T////s89vZ57e40nq+1oXL3p6Zv0K91YPd6sDy9+f9/vv9/fvz9+mcwEanx1vK3ZupyF6ewUnS46uxzm630Xj1+e291YXv9eGXvT7R4qnI3Jnc6b7R4ajt9N7G25TV5LDf68OixFL6/PX8/fmmxljA14nr89rP4KWdwUjB2IzT463D2Y/x9uTN36H4+/P7/PfB14uvzGmixFGZvkDb6Lvi7cmewkuwzWy6037g68Xq8teewUr3+vDr8tnh7Me71ICfwkygw07t892lxleryWKbwEX1+ezX5rWvzWu10HWzz3HH3JeoyFz3+vGYvj/W5bPF2pO/14ity2Wty2b7/fjK3p3p8dW20HaqyWD4+vGbv0TV5bGhw1Da57q0z3OWuz2StT1wfkCDnT+Fnz5ncEFUUUJKQENJP0OMqz5rdkBwfUB2h0B/lz+NrT5XVkJmbkF6jz9cXkJbXEJ9kz9hZkGGoT5OR0NNRkNpckFdX0FaW0JYV0KBmT9WVEKAlz+VuT1aWkJqdEBeYkGIpT5gZEGTtz2Hoz6PsD5LQkOPsT6Rsz1STkJlbEF8kT9kakFTUEJseEBxgEBORkNeYUF/lT+Lqj5MREN4iz+Cmz9iaEFRTEJtekB3ij9ocEGJpj6Kpz5zg0Dn79HP4afw9eOFbwBnAAAKcUlEQVR4AezBAQEAAAQAIP6fNgNUMREAAAAAAGSxYxdKjuNQFIaP4Xa3HWqM3czMDMM8GWbmef932D1y7iZyJVMNWs43ZKlSyp+URonbD0IR6erugYri30XIKxRL5Yr09pWiftQNxGowGso/PDYa015MHi6smoiScopMwFGAnOE+USOjyPRIk7HRcTRJxZjITaQXb+6SZtEvoidFaYodTVMFNEyLMeM6WptV6LWNHhXbrBWt5tAwIxnPcXQiOfPtohcWJbMkmcqAFa2WoTypW3EbrbvOA9JVMbw20XNZ6ZqH9Y2sv9SI3oy21rbF2IHakLqS2+h5oQRU3RWKWkev7wntgw4q5gUcQqN57hwdC51Yi1e4/cIjl9FVoTIysVB36+iiNE9tCm1Z0bi0ZP23O1rkObrGucvuovUZk+Y9WE5aR3cLXUFmSOiqHY1rwkxrL8wN65ZxFh3bi8zHw167I29M6LoORzi6kYu+yctbqFvj6PYd/r3qMjoQqsLSMrpgdvEI1C2hu1b0dbM9JlF3j6P7GDMPdB6NU0QvC93MnSW15ugH87zaYx8tcPQQeMR/Rx1Gl7nG7mmiHwvdym2sJxr9yPc3H4rmGSscTQH7/PfYYbRQcJrop0LHUM+EIo1WYRGqxLEPPOe/L17+KdG1VFXtaNK2V1Cvhd7kooMFqKOQE2+Bl+b4f+c+2mSqtH10ktsefi5a3id6vlw2G/wIwAmvPvxjo6l8Xw88XWGQVx8dR8tpop+2jN7S6Kl4be6aGDNHoC79UMlKK9f/hui3Qo+gJoSK1jl98FA3OnCopwvQb474267Pab3BetQuWiPmoR5plEbTp8Y3pjdCfkQj+nqdR1PaPvrlEmdWc5+In+3ol+bE+KIHnuXhuKvoxFqkfbTu0UpBh2Nm+NWORlnoSPMtn11FR0L+aaK/CT1F5o7QPdjR47tCX/UD1DLpKtoTKp8m+rbQFDKzQtO56KdCSwB2RPICV9FYtd7q+BfR/XtNb/VyKPTOjr6/LfRR133RXTfDUaXfVXQkRneNTx+IHd2VNlQxJ7T4poCXt0e0rnGPuP9sakmMQeC73gORHiU9Gu2nf6hd4K1WdrQ96b0XY2871DmNtix9ByL7JnxAaI7ROQHOo7YrOWWvdTS2xJagZTT32pTQAOrGX5iFnUUjylVPVNEmGmvS7MfLltEx9IvdDUBdFRpwFo1ac+A849pFY/SFqHBrHC2iA/O4A6FS/gdqvqtoSh+Znb0673uoi+IcD9S/f/WhSGXk6kYVdZ8TtTZ5ZQFGmtBPQD1PaBRenBPhL7KO/72Ojo4/QUdHR8dvzNiFcuM8EMDxfVjLTuoNGUIuMzMzPmdhN+patvR9B1Hn/kPdbeB3c7bGd4FS8E8WVopgUqM5EyPGM03aUK221On2EtBFjg9J2il+lmaTRR7Wgz8IK4UTX19Wg5a2oVk6BC60fojKZDNS8Fkf600PPS6w1GxkoqUscKNVavwBlW90ImZWtxxonHOjxUy1faPnsdKCC42RC50jVcwvIpdMGb3Y+C4BgCWkllfUamPi7wl6LQzDzvp8jNSGoLvGh/R5p/n042aDWqS5wf0xug9GW3IVQsDDvKDbQCWsire/0RGUk7dBWPkSfidwU0KrmJY7PO3u0bRfRcNBwVQ7Oird1gn9fOgVPeSDTo9HNB7X0HDCv3Ci5bWnNHhFn9HuXI85HxN19DqNuR2d0OpCAQBfy5vgFX1Juys9XvNL6ugRjUt2NBRyY3B+0af6kuZWaTytofdvaNx1oDOkLvKfQcudx13gZ3tVdLJG06IcD5nx6JHgpMPcC1qKZLUKukOalUZf5nl+G27toVxFoe1RIEdhe0dvIwUV9D6jKzXBiWY1l256Riu+FqvoxIZeD+xoLjqVXfeH0YULPbgDcKG5XNjZtNHF/KRNPi1M9IUdHXeBs92IFnbu//TYq6IP5EbsZjH9dL9qoMtWC/tC+UQfmqdHgFRQPvJ6rD76BbT8Cyb3iR7QrqXHfRoL85zuyIHnRCfRJnCsHvlEN/UTNLdD45qJXuW/84dtFzotwxL+Fp/oLu0e9fhE47OJhmPkV7nQSCngTr2jX2g3EwC3ZX00DRZp2Nt3oPvGU9ehdzQclu+bMQ3xQQUNK0idOdCZfLB+Y+YVzXfZ7Bg+e33g0w0MtNyvNwd29FXpxFCp79NDHjrjo6fb5h5SO3V0Q65qRqf97wBUgVQ/DNt80BfKKxrebP+9IWjjYr9RjDYCyy4Ev+hghEaDVRt6U2OsaFhEoww8o2H1BEttbYMNDfc0Xyg7Ws2bZq9obpjipPQYwI6+jmlxbkObD0vzluMQfPT6dJY1z25fZbOafHUgi11a7IOzzTz8LE/gg52zbJgTBoJwIHBaF6D6qSd1d/dSd/f+tsq/rNzeDkNeeDV15hNZ7EnI7umkUaNGjRo1atTo71VQ/kNwkomMSpqJtjoTHeNzHQVGlPcG1tp2GDi3Ctw7L0Ld8l/Vw1iUK2XJjdx/Js1b9BdxVz05zyLQ1h73sJ+adgnG4ASuWFGIPrGN7kMsOjAXdMiRKPcNbfQ/u6IIPmz3ymzXvjAHdNe1ovuGhimAjd6YLxY3gk0EPs5a6NyNWd/QbfZkFUMU8Mh3qEswStZDW9k6eHPrzliUeYYO+dy2syRCUurBHux9X2cAo77ZhHwSPqGRiREZgvQ22HmQ/yO/HD7OOuhUTkoosyPP0IbKRxBDrZmPoT8xumRjMXTWQ7d4wnUwP7xCr8BVtcAVvUhxH7ULrep/go+zBloxqXWw6xMaDzAsGMMi+axuwoH4QiwYn+qhs3Jz586b3dxv9cDJKR6szYtApHmIgvfZbICPsxq6gybLM3SGk5Mp7UENBMhDNDaYK7wmAkPXw3iGBmpE1jGrEBlfd4++rHyBj3Mx0O1sqvbioZGJiU7pRL1yGBua+5u1mN9YJLQvc85AGVtTQ2qmrG3Kw/5IBliH/NXvhYYDHAmol7PIQ+3JDiztcbcOevAroGFjz3RcBTbSGsurE92D+9f+XuhAzp5eNMDlc91RrE70emIyOyE+zt86PaTERTK+K4qxDzG30bMzk+3nUvx+Z8nD1JWKVFTBQY/ycIcakmH/3fY7oXE1eku6czLoA8wX9a4/DH9oHT4n1EO3tJl4h+ZMNISYCpbEsTqRo7Xzeu/RjQbdxD80fzw6iG6oLEhchdXQecXADzreoU0MDbSgQCkW63B1Yl5vTQe4rmdoO2P0ViDSxepErsb9amjLHwKSCNf1DJ0CJKePuxQZxlX64ELzp84ooUac+4fuYkpzREQO+5azuEdaDZ3QN0t5hErjGzqnKe1ELBW8vThBOrG5EhqPaUWvm0YxSH1DIxN7iBzkPDwm975kyssExEE1dOCa/g8mvqE5EzNEBpyHp2T7nVFtOT8J7KmExuSCOsY3NOedgULkIQrefgOhkDF0LXXX+IZmRMvTnFBaeFtSXqRrdIyhWZ0V7qqj3qHV7Z9RiFz/x2T7CK/pJqErdKgpa8NkqYKdNzcgkuEe1OyaX6Rv7cGBAAAAAIAgf+tBrm4AAAAACLoA08RDMKAPAAAAAElFTkSuQmCC',
                    principalColor: '#97be32',
                },
                'forest-atlas': {
                    name: 'Forest Atlas',
                    logo: 'https://wriorg.s3.amazonaws.com/s3fs-public/styles/large/public/forest-atlases-logo-1.png?itok=BV_4QvsM',
                    principalColor: '#008d6a',
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
                }
            }
        };

        return Settings.settings;
    }
}
