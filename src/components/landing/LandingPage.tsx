import React from 'react';
import { 
  Users, Banknote, Shield, Smartphone, ArrowRight, 
  CheckCircle2, Building2, MapPin, Sparkles, Award,
  Leaf, Handshake, Landmark
} from 'lucide-react';
import { motion } from 'motion/react';
import { PWAInstallButton } from '../common/PWAInstallButton';
import { Corporation, ZoneItem } from '../../types';
import { APP_LOGO } from '../../data/initialData';
import heroBgImg from '../../assets/images/dosso_agriculture_hero_1794502587453.jpg';
import meetingImg from '../../assets/images/microfinance_community_meeting_1794502588567.jpg';

interface LandingPageProps {
  totalMembres: number;
  soldeTotal: number;
  collecteAujourdhui: number;
  corporations: Corporation[];
  zones: ZoneItem[];
  onOpenMemberAuth: (mode?: 'login' | 'register') => void;
  onOpenAdminAuth: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  totalMembres,
  soldeTotal,
  collecteAujourdhui,
  corporations,
  zones,
  onOpenMemberAuth,
  onOpenAdminAuth,
}) => {
  return (
    <div className="flex flex-col">
      {/* HERO SECTION - Cinematic & Editorial */}
      <section className="relative h-[85vh] min-h-[600px] flex items-center overflow-hidden">
        {/* Background Image with Scrim */}
        <div className="absolute inset-0 z-0">
          <img 
            src={heroBgImg} 
            alt="Agriculture Dosso"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-charcoal/90 via-charcoal/40 to-transparent dark:from-slate-950/95 dark:via-slate-950/50" />
        </div>

        <div className="container relative z-10 mx-auto px-6 grid lg:grid-cols-2 gap-12 items-center">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-8"
          >
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-gold dark:text-amber-400 font-display font-semibold tracking-widest uppercase text-xs">
                <span className="w-8 h-px bg-current" />
                République du Niger · Région de Dosso
              </div>
              <h1 className="text-5xl lg:text-7xl font-display font-bold text-white leading-[1.1] tracking-tight text-wrap-balance">
                L'Excellence de la <br />
                <span className="text-gold italic font-editorial">Finance Solidaire</span>
              </h1>
              <p className="text-lg text-slate-200/90 max-w-lg leading-relaxed font-body">
                Le Programme Régional PMES-AGR Dosso accompagne les coopératives et entrepreneurs locaux avec des solutions de micro-finance éthiques et innovantes.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => onOpenMemberAuth('login')}
                className="px-8 py-4 bg-gold hover:bg-gold/90 text-white rounded-lg font-display font-semibold transition-all shadow-lg hover:shadow-gold/20 flex items-center gap-2 group"
              >
                Accéder à mon Livret
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button
                onClick={() => onOpenMemberAuth('register')}
                className="px-8 py-4 bg-white/10 hover:bg-white/20 text-white border border-white/30 backdrop-blur-md rounded-lg font-display font-semibold transition-all"
              >
                Devenir Membre
              </button>
            </div>
            
            <div className="flex items-center gap-12 pt-8 border-t border-white/10">
              <div className="space-y-1">
                <div className="text-3xl font-display font-bold text-white tabular">{totalMembres.toLocaleString()}</div>
                <div className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Adhérents</div>
              </div>
              <div className="space-y-1">
                <div className="text-3xl font-display font-bold text-white tabular">{soldeTotal.toLocaleString()} F</div>
                <div className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Fonds Gérés</div>
              </div>
              <div className="space-y-1">
                <div className="text-3xl font-display font-bold text-white">100%</div>
                <div className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Proximité</div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* MISSION & VALUES - 2-Column Split */}
      <section className="py-24 bg-paper dark:bg-slate-900 overflow-hidden">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-20 items-stretch">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="space-y-12 flex flex-col justify-center"
            >
              <div className="space-y-6">
                <h2 className="text-4xl font-display font-bold text-charcoal dark:text-white">Une Vision pour le Développement <span className="text-gold">Régional</span></h2>
                <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed font-body">
                  Nous croyons en une finance qui sert l'économie réelle. PMES-AGR n'est pas seulement une banque, c'est un moteur de croissance pour les 17 communes de la région.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-8">
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-lapis/5 flex items-center justify-center text-lapis">
                    <Handshake className="w-6 h-6" />
                  </div>
                  <h3 className="font-display font-bold text-charcoal dark:text-white">Confiance Mutuelle</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">Basé sur les valeurs de solidarité et de transparence totale avec nos membres.</p>
                </div>
                <div className="space-y-3">
                  <div className="w-12 h-12 rounded-xl bg-gold/5 flex items-center justify-center text-gold">
                    <Leaf className="w-6 h-6" />
                  </div>
                  <h3 className="font-display font-bold text-charcoal dark:text-white">Finance Éthique</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">Des modèles de financement sans usure, conformes aux principes de la finance participative.</p>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative rounded-3xl overflow-hidden shadow-2xl h-[500px]"
            >
              <img 
                src={meetingImg} 
                alt="Communauté PMES"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal/60 to-transparent" />
              <div className="absolute bottom-8 left-8 right-8 text-white">
                <p className="editorial text-xl italic leading-relaxed">
                  "Notre force réside dans notre capacité à transformer l'épargne locale en leviers de réussite pour nos entrepreneurs."
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="w-10 h-px bg-gold" />
                  <span className="text-sm font-semibold tracking-widest uppercase">Direction Générale</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* SOLUTIONS - 3-Tier Salience */}
      <section className="py-24 bg-white dark:bg-slate-950 border-y border-slate-200/60 dark:border-slate-800/60">
        <div className="container mx-auto px-6 space-y-16">
          <div className="text-center space-y-4">
            <div className="text-gold font-display font-bold tracking-[0.2em] uppercase text-[10px]">Nos Solutions</div>
            <h2 className="text-4xl font-display font-bold text-charcoal dark:text-white">Services Financiers de Proximité</h2>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {/* Savings */}
            <div className="group p-8 rounded-2xl bg-paper dark:bg-slate-900 hairline transition-all hover:shadow-xl hover:-translate-y-1">
              <div className="w-14 h-14 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform">
                <Landmark className="w-7 h-7 text-lapis" />
              </div>
              <h3 className="text-xl font-display font-bold text-charcoal dark:text-white mb-4">Épargne & Tontine</h3>
              <p className="text-slate-500 leading-relaxed text-sm mb-6">
                Sécurisez vos revenus quotidiens avec notre système de collecte mobile. Suivez l'évolution de votre solde en temps réel.
              </p>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Collecte au marché
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Reçus certifiés QR
                </li>
              </ul>
            </div>

            {/* Credit */}
            <div className="group p-8 rounded-2xl bg-paper dark:bg-slate-900 hairline transition-all hover:shadow-xl hover:-translate-y-1 border-gold/20">
              <div className="w-14 h-14 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform">
                <Banknote className="w-7 h-7 text-gold" />
              </div>
              <h3 className="text-xl font-display font-bold text-charcoal dark:text-white mb-4">Financement AGR</h3>
              <p className="text-slate-500 leading-relaxed text-sm mb-6">
                Développez vos Activités Génératrices de Revenus avec nos contrats Mourabaha et Moudaraba adaptés à vos besoins.
              </p>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Approbation rapide
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Zéro intérêt (Usure)
                </li>
              </ul>
            </div>

            {/* PWA */}
            <div className="group p-8 rounded-2xl bg-paper dark:bg-slate-900 hairline transition-all hover:shadow-xl hover:-translate-y-1">
              <div className="w-14 h-14 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform">
                <Smartphone className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="text-xl font-display font-bold text-charcoal dark:text-white mb-4">Application Mobile</h3>
              <p className="text-slate-500 leading-relaxed text-sm mb-6">
                Une technologie conçue pour le désert. Fonctionne sans connexion Internet constante pour une fluidité totale.
              </p>
              <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Mode Hors-Ligne
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Installation PWA
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CORPORATIONS - Institutional Catalog */}
      <section className="py-24 bg-paper dark:bg-slate-900">
        <div className="container mx-auto px-6 space-y-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-4">
              <h2 className="text-3xl font-display font-bold text-charcoal dark:text-white">Nos Corporations Partenaires</h2>
              <p className="text-slate-500 max-w-lg">
                Nous accompagnons plus de {corporations.length} corps de métiers organisés en coopératives dans toute la région de Dosso.
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm font-semibold text-gold">
              <span>{corporations.reduce((acc, c) => acc + c.membres, 0).toLocaleString()} Membres actifs</span>
              <div className="w-8 h-px bg-gold/30" />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {corporations.map((c, i) => (
              <motion.div 
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                viewport={{ once: true }}
                className="p-4 bg-white dark:bg-slate-800 rounded-xl hairline flex flex-col items-center text-center gap-3 group hover:border-gold/30 transition-colors"
              >
                <span className="text-3xl group-hover:scale-110 transition-transform">{c.emoji}</span>
                <div>
                  <div className="text-[11px] font-bold text-charcoal dark:text-white truncate w-full">{c.nom}</div>
                  <div className="text-[10px] text-slate-400 tabular">{c.membres} membres</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CALL TO ACTION */}
      <section className="py-24">
        <div className="container mx-auto px-6">
          <div className="relative rounded-[2rem] overflow-hidden bg-lapis p-12 lg:p-20 text-center space-y-10 shadow-2xl">
            {/* Background Texture */}
            <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent" />
            
            <div className="relative z-10 max-w-2xl mx-auto space-y-6">
              <h2 className="text-4xl lg:text-5xl font-display font-bold text-white leading-tight">
                Prêt à faire fructifier votre <span className="text-gold italic font-editorial">Épargne</span> ?
              </h2>
              <p className="text-slate-300 text-lg">
                Rejoignez le réseau PMES-AGR Dosso dès aujourd'hui et participez au renforcement de l'économie de notre région.
              </p>
            </div>

            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => onOpenMemberAuth('register')}
                className="w-full sm:w-auto px-10 py-5 bg-gold hover:bg-gold/90 text-white rounded-xl font-display font-bold transition-all shadow-xl hover:shadow-gold/30 text-lg"
              >
                S'inscrire Maintenant
              </button>
              <button
                onClick={onOpenAdminAuth}
                className="w-full sm:w-auto px-10 py-5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl font-display font-bold transition-all backdrop-blur-sm text-lg"
              >
                Portail Administration
              </button>
            </div>
            
            <div className="relative z-10 pt-8 flex items-center justify-center gap-8 text-slate-400 text-xs uppercase tracking-widest font-bold">
              <span>Sécurisé</span>
              <span className="w-1 h-1 rounded-full bg-slate-600" />
              <span>Translucide</span>
              <span className="w-1 h-1 rounded-full bg-slate-600" />
              <span>Dosso</span>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER - Minimal Institutional */}
      <footer className="py-12 border-t border-slate-200/60 dark:border-slate-800/60 bg-paper dark:bg-slate-900">
        <div className="container mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-4">
            <img src={APP_LOGO} alt="PMES Dosso" className="w-12 h-12 rounded-full grayscale opacity-50" />
            <div>
              <div className="font-display font-bold text-charcoal dark:text-white">PMES-AGR DOSSO</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Programme Micro-Finance & Entreprises Sociales</div>
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-6 sm:gap-8 text-xs font-semibold text-slate-500 uppercase tracking-widest">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="hover:text-gold transition-colors cursor-pointer uppercase tracking-widest"
            >
              Haut de page
            </button>
            <button
              type="button"
              onClick={() => onOpenMemberAuth('login')}
              className="hover:text-gold transition-colors cursor-pointer uppercase tracking-widest"
            >
              Espace Membre
            </button>
            <a href="tel:+22793272000" className="hover:text-gold transition-colors">
              Support
            </a>
          </div>

          <div className="text-[10px] text-slate-400 text-center md:text-right">
            © {new Date().getFullYear()} Région de Dosso. Tous droits réservés.<br />
            République du Niger
          </div>
        </div>
      </footer>
    </div>
  );
};
