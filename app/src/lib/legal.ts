export interface LegalDoc { title: string; draft?: boolean; sections: { h: string; p: string }[] }

export const DOCS: Record<string, LegalDoc> = {
  guidelines: {
    title: 'Community Guidelines',
    sections: [
      { h: 'This is a home for queer women', p: 'LICKD exists to give Black queer women, lesbians and queer women a place to find each other. Everyone here should feel welcome, safe and respected.' },
      { h: 'Be kind', p: 'No harassment, bullying, threats, or hate speech aimed at anyone, including because of race, gender identity, sexuality, disability, religion, body or class. Disagree without attacking.' },
      { h: 'Respect consent', p: 'No unwanted sexual messages or images. Nudity and sexually explicit content are not allowed on public surfaces. Do not share anyone\'s private photos or information without their permission.' },
      { h: 'Be real', p: 'No impersonation, scams, spam, fake giveaways or misleading links. One person, one account.' },
      { h: 'Adults only', p: 'You must be 18 or older. Report anyone who appears to be under 18. Content involving minors is removed and may be reported to authorities.' },
      { h: 'Keep each other safe', p: 'Do not post content that promotes self-harm, violence or dangerous activity. If you are in crisis, please contact local emergency services or a crisis line.' },
      { h: 'Dating', p: 'Dating profiles are opt-in. Respect a pass or a block. Never pressure someone to move off the app or share personal details.' },
      { h: 'What happens when rules are broken', p: 'Moderators can remove content, issue warnings, suspend accounts, or ban accounts. You can appeal a suspension or ban from the account screen.' },
      { h: 'Your tools', p: 'You can report, block and mute from any profile, post, message or story. Reports are private. You can also control who can message, friend and find you in Settings.' },
    ],
  },
  terms: {
    title: 'Terms of Service', draft: true,
    sections: [
      { h: 'Agreement', p: 'By creating an account you agree to these terms and the Community Guidelines. You must be 18 or older.' },
      { h: 'Your content', p: 'You own what you post. You give LICKD permission to host, display and distribute it within the app so the service works.' },
      { h: 'Your account', p: 'Keep your password secure. You are responsible for activity on your account. We may suspend or remove accounts that break the rules.' },
      { h: 'Termination', p: 'You can delete your account any time in Settings. We may suspend or end access for violations.' },
      { h: 'Disclaimers and liability', p: 'Placeholder. Replace with counsel-approved language on warranties, limits of liability, governing law and dispute resolution.' },
    ],
  },
  privacy: {
    title: 'Privacy Policy', draft: true,
    sections: [
      { h: 'What we collect', p: 'Account details (email), profile information you add, content you post, messages, and basic usage data to run and improve the app.' },
      { h: 'Your date of birth', p: 'Used only to confirm you are 18 or older. It is never shown to other members.' },
      { h: 'Location', p: 'Optional. You choose a city; exact location is never shown publicly.' },
      { h: 'Sharing', p: 'We do not sell your personal information. Placeholder: list service providers (hosting, analytics, push notifications) here.' },
      { h: 'Deleting your data', p: 'Delete your account in Settings to remove your profile and content. Placeholder: document retention periods for backups and safety records.' },
      { h: 'Contact', p: 'Placeholder: add a support and privacy contact email.' },
    ],
  },
};
