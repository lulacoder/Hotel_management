// Comprehensive multi-column hospitality footer with branding, curated destinations, guest services, and trust signals.
import { Link } from '@tanstack/react-router'
import {
  CreditCard,
  Headphones,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'

import { CURRENT_YEAR } from '../lib/currentYear'
import { getHotelCategoryLabel } from '../lib/hotelCategories'
import { useI18n } from '../lib/i18n/provider'
import {
  DEFAULT_AUTH_SEARCH,
  DEFAULT_SELECT_LOCATION_SEARCH,
} from '../lib/navigationSearch'
import { staticAssets } from '../lib/staticAssets'

export function Footer() {
  const { t } = useI18n()

  const popularDestinations = [
    { name: 'Addis Ababa', city: 'Addis Ababa' },
    { name: 'Bishoftu', city: 'Bishoftu' },
    { name: 'Hawassa', city: 'Hawassa' },
    { name: 'Bahir Dar', city: 'Bahir Dar' },
  ]

  const stayCategories = [
    { category: 'Luxury' },
    { category: 'Boutique' },
    { category: 'Resort and Spa' },
    { category: 'Suite' },
  ]

  return (
    <footer className="relative border-t border-slate-200 bg-slate-50/90 text-slate-700 transition-colors dark:border-slate-800/80 dark:bg-slate-950 dark:text-slate-300">
      {/* Subtle top accent gradient */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent" />

      {/* Trust & Guarantee Banner */}
      <div className="border-b border-slate-200/80 bg-white/70 py-6 dark:border-slate-800/60 dark:bg-slate-900/30">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-6 px-6 sm:grid-cols-2 sm:px-10 lg:grid-cols-4">
          <div className="flex items-center gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {t('footer.verifiedStays')}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('footer.verifiedStaysDesc')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <CreditCard className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {t('footer.securePayments')}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('footer.securePaymentsDesc')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Headphones className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {t('footer.guestCare')}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('footer.guestCareDesc')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {t('footer.bestRate')}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t('footer.bestRateDesc')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Multi-Column Content */}
      <div className="mx-auto max-w-[1400px] px-6 pt-14 pb-12 sm:px-10">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-5 lg:gap-12">
          {/* Brand & Mission Column */}
          <div className="lg:col-span-2">
            <Link to="/" className="inline-block">
              <img
                src={staticAssets.logo}
                alt="Tripways Hotels"
                className="h-9 w-auto opacity-95"
              />
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {t('footer.brandDescription')}
            </p>
            <div className="mt-6 flex flex-col gap-2 text-xs text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-2">
                <MapPin className="size-4 shrink-0 text-violet-500" />
                <span>{t('footer.address')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="size-4 shrink-0 text-violet-500" />
                <span>support@Tripways.com</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="size-4 shrink-0 text-violet-500" />
                <span>+251 11 000 0000</span>
              </div>
            </div>
          </div>

          {/* Column 2: Destinations */}
          <div>
            <h3 className="text-xs font-bold tracking-widest text-slate-900 uppercase dark:text-slate-100">
              {t('footer.topDestinations')}
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {popularDestinations.map((dest) => (
                <li key={dest.city}>
                  <Link
                    to="/select-location"
                    search={{
                      ...DEFAULT_SELECT_LOCATION_SEARCH,
                      city: dest.city,
                    }}
                    className="text-slate-600 transition-colors hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400"
                  >
                    {t('footer.hotelsInCity', { city: dest.name })}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Stay Collections */}
          <div>
            <h3 className="text-xs font-bold tracking-widest text-slate-900 uppercase dark:text-slate-100">
              {t('footer.collections')}
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              {stayCategories.map((item) => (
                <li key={item.category}>
                  <Link
                    to="/select-location"
                    search={{
                      ...DEFAULT_SELECT_LOCATION_SEARCH,
                      category: item.category,
                    }}
                    className="text-slate-600 transition-colors hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400"
                  >
                    {getHotelCategoryLabel(item.category, t)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Guest Services & Links */}
          <div>
            <h3 className="text-xs font-bold tracking-widest text-slate-900 uppercase dark:text-slate-100">
              {t('footer.guestServices')}
            </h3>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <Link
                  to="/select-location"
                  search={DEFAULT_SELECT_LOCATION_SEARCH}
                  className="text-slate-600 transition-colors hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400"
                >
                  {t('footer.browseStays')}
                </Link>
              </li>
              <li>
                <Link
                  to="/bookings"
                  className="text-slate-600 transition-colors hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400"
                >
                  {t('footer.myReservations')}
                </Link>
              </li>
              <li>
                <Link
                  to="/sign-in"
                  search={DEFAULT_AUTH_SEARCH}
                  className="text-slate-600 transition-colors hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400"
                >
                  {t('footer.guestSignIn')}
                </Link>
              </li>
              <li>
                <Link
                  to="/sign-up"
                  search={DEFAULT_AUTH_SEARCH}
                  className="text-slate-600 transition-colors hover:text-violet-600 dark:text-slate-400 dark:hover:text-violet-400"
                >
                  {t('footer.createAccount')}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Utility Bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-200/80 pt-8 sm:flex-row dark:border-slate-800/80">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            &copy; {CURRENT_YEAR} Tripways Hotels. {t('common.allRightsReserved')}
          </p>
        </div>
      </div>
    </footer>
  )
}
