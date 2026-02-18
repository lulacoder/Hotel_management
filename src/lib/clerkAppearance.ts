import type { Theme } from './theme'

export function getClerkAuthAppearance(theme: Theme) {
  if (theme === 'light') {
    return {
      elements: {
        rootBox: 'w-full',
        card: 'bg-white/90 border border-slate-200 shadow-2xl shadow-slate-300/30 rounded-2xl',
        headerTitle: 'text-slate-900',
        headerSubtitle: 'text-slate-600',
        socialButtonsBlockButton:
          'bg-white border-slate-300 text-slate-900 hover:bg-slate-50',
        socialButtonsBlockButtonText: 'text-slate-700 font-medium',
        dividerLine: 'bg-slate-300',
        dividerText: 'text-slate-500',
        formFieldLabel: 'text-slate-700',
        formFieldInput:
          'bg-white border-slate-300 text-slate-900 placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20',
        formButtonPrimary:
          'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold shadow-lg shadow-amber-500/25',
        footerActionLink: 'text-amber-600 hover:text-amber-500',
        identityPreviewText: 'text-slate-700',
        identityPreviewEditButton: 'text-amber-600',
        formFieldInputShowPasswordButton: 'text-slate-500',
        footer: 'hidden',
      },
    }
  }

  return {
    elements: {
      rootBox: 'w-full',
      card: 'bg-slate-900/50 border border-slate-800 shadow-2xl shadow-black/50 rounded-2xl',
      headerTitle: 'text-white',
      headerSubtitle: 'text-slate-400',
      socialButtonsBlockButton:
        'bg-slate-800 border-slate-700 text-white hover:bg-slate-700',
      socialButtonsBlockButtonText: 'text-slate-300 font-medium',
      dividerLine: 'bg-slate-700',
      dividerText: 'text-slate-500',
      formFieldLabel: 'text-slate-300',
      formFieldInput:
        'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus:border-amber-500 focus:ring-amber-500/20',
      formButtonPrimary:
        'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold shadow-lg shadow-amber-500/25',
      footerActionLink: 'text-amber-400 hover:text-amber-300',
      identityPreviewText: 'text-slate-300',
      identityPreviewEditButton: 'text-amber-400',
      formFieldInputShowPasswordButton: 'text-slate-400',
      footer: 'hidden',
    },
  }
}
