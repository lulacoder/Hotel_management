import type { Theme } from './theme'

export function getClerkAuthAppearance(theme: Theme) {
  if (theme === 'light') {
    return {
      elements: {
        rootBox: 'w-full',
        card: 'rounded-3xl border border-slate-200/90 bg-white/95 shadow-2xl shadow-slate-300/30 backdrop-blur-xl',
        headerTitle: 'text-slate-900',
        headerSubtitle: 'text-slate-600',
        socialButtonsBlockButton:
          'border-slate-300 bg-white text-slate-900 hover:bg-slate-50',
        socialButtonsBlockButtonText: 'text-slate-700 font-medium',
        dividerLine: 'bg-slate-300',
        dividerText: 'text-slate-500',
        formFieldLabel: 'text-slate-700',
        formFieldInput:
          'h-12 rounded-xl border-slate-300 bg-white text-slate-900 placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20',
        formButtonPrimary:
          'h-11 rounded-xl bg-slate-900 text-white font-semibold shadow-lg shadow-slate-900/25 hover:bg-slate-800',
        footerActionLink: 'text-violet-600 hover:text-violet-500',
        identityPreviewText: 'text-slate-700',
        identityPreviewEditButton: 'text-violet-600',
        formFieldInputShowPasswordButton: 'text-slate-500',
        footer: 'hidden',
      },
    }
  }

  return {
    elements: {
      rootBox: 'w-full',
      card: 'rounded-3xl border border-slate-800 bg-slate-900/70 shadow-2xl shadow-black/50 backdrop-blur-xl',
      headerTitle: 'text-white',
      headerSubtitle: 'text-slate-400',
      socialButtonsBlockButton:
        'border-slate-700 bg-slate-800 text-white hover:bg-slate-700',
      socialButtonsBlockButtonText: 'text-slate-300 font-medium',
      dividerLine: 'bg-slate-700',
      dividerText: 'text-slate-500',
      formFieldLabel: 'text-slate-300',
      formFieldInput:
        'h-12 rounded-xl border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 focus:border-violet-500 focus:ring-violet-500/20',
      formButtonPrimary:
        'h-11 rounded-xl bg-white text-slate-900 font-semibold shadow-lg shadow-black/20 hover:bg-slate-100',
      footerActionLink: 'text-violet-400 hover:text-violet-300',
      identityPreviewText: 'text-slate-300',
      identityPreviewEditButton: 'text-violet-400',
      formFieldInputShowPasswordButton: 'text-slate-400',
      footer: 'hidden',
    },
  }
}
