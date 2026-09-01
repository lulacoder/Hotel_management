import type { Theme } from './theme'

export function getClerkAuthAppearance(theme: Theme) {
  const isLight = theme === 'light'

  return {
    variables: {
      colorPrimary: '#7c3aed', // violet-600
      colorTextOnPrimaryBackground: '#ffffff',
      borderRadius: '0.75rem',
      colorBackground: isLight ? '#ffffff' : '#0f172a',
      colorInputBackground: isLight ? '#ffffff' : '#1e293b',
      colorInputText: isLight ? '#0f172a' : '#f8fafc',
      colorText: isLight ? '#0f172a' : '#ffffff',
      colorTextSecondary: isLight ? '#64748b' : '#94a3b8',
      colorNeutral: isLight ? '#0f172a' : '#ffffff',
    },
    elements: {
      rootBox: 'w-full',
      card: isLight
        ? 'rounded-3xl border border-slate-200/90 bg-white/95 shadow-2xl shadow-slate-300/30 backdrop-blur-xl'
        : 'rounded-3xl border border-slate-800 bg-slate-900/70 shadow-2xl shadow-black/50 backdrop-blur-xl',
      headerTitle: isLight ? '!text-slate-900' : '!text-white',
      headerSubtitle: isLight ? '!text-slate-600' : '!text-slate-400',
      socialButtonsBlockButton: isLight
        ? '!border-slate-300 !bg-white !text-slate-900 hover:!bg-slate-50'
        : '!border-slate-700 !bg-slate-800 !text-white hover:!bg-slate-700',
      socialButtonsBlockButtonText: isLight
        ? '!text-slate-900 font-medium'
        : '!text-white font-medium',
      socialButtonsBlockButton__google: isLight
        ? '!text-slate-900'
        : '!text-white',
      dividerLine: isLight ? 'bg-slate-300' : 'bg-slate-700',
      dividerText: isLight ? '!text-slate-500' : '!text-slate-400',
      formFieldLabel: isLight ? '!text-slate-700' : '!text-slate-300',
      formFieldInput: isLight
        ? 'h-12 rounded-xl !border-slate-300 !bg-white !text-slate-900 placeholder:!text-slate-400 focus:!border-violet-500 focus:!ring-violet-500/20'
        : 'h-12 rounded-xl !border-slate-700 !bg-slate-800 !text-white placeholder:!text-slate-500 focus:!border-violet-500 focus:!ring-violet-500/20',
      formButtonPrimary:
        'h-11 rounded-xl !bg-violet-600 !text-white font-semibold shadow-lg shadow-violet-600/30 hover:!bg-violet-700 active:!bg-violet-800 transition-all focus:ring-2 focus:ring-violet-500/50',
      footerActionLink: isLight
        ? '!text-violet-600 hover:!text-violet-500'
        : '!text-violet-400 hover:!text-violet-300',
      identityPreviewText: isLight ? '!text-slate-700' : '!text-slate-300',
      identityPreviewEditButton: isLight ? '!text-violet-600' : '!text-violet-400',
      formFieldInputShowPasswordButton: isLight
        ? '!text-slate-500'
        : '!text-slate-400',
      footer: 'hidden',
    },
  }
}


