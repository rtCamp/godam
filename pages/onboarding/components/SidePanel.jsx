/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { FEATURE_ICONS, CheckIcon } from './icons';

/**
 * Right-hand marketing panel of the onboarding modal. Two variants from the
 * design: a feature icon-grid and a social-proof panel.
 *
 * All copy is placeholder pending final strings (pricing page).
 *
 * @param {Object} props         Props.
 * @param {string} props.variant 'features' | 'social'.
 */
const FEATURES = [
	{ icon: 'globe', title: __( 'Sites', 'godam' ), body: __( 'Use GoDAM on unlimited WordPress sites.', 'godam' ) },
	{ icon: 'gauge', title: __( 'Bandwidth', 'godam' ), body: __( 'Generous bandwidth that resets every month.', 'godam' ) },
	{ icon: 'team', title: __( 'Users', 'godam' ), body: __( 'Invite unlimited editors and contributors.', 'godam' ) },
	{ icon: 'shield', title: __( 'Security', 'godam' ), body: __( 'Enterprise-grade encryption.', 'godam' ) },
	{ icon: 'storage', title: __( 'Storage', 'godam' ), body: __( 'A one-time storage allocation that stays yours.', 'godam' ) },
];

const SOCIAL_POINTS = [
	__( 'No credit card required', 'godam' ),
	__( 'Drive conversions with AI-powered tools', 'godam' ),
	__( 'Set up in minutes on your existing site', 'godam' ),
];

const SidePanel = ( { variant = 'features' } ) => (
	<aside className="godam-onboarding__aside" data-test-id={ `godam-onboarding-panel-${ variant }` }>
		{ variant === 'social' ? (
			<div className="godam-onboarding__aside-inner">
				<p className="godam-onboarding__eyebrow">{ __( 'Used by forward-thinking teams', 'godam' ) }</p>
				<ul className="godam-onboarding__checklist">
					{ SOCIAL_POINTS.map( ( point ) => (
						<li key={ point }>
							<span className="godam-onboarding__check"><CheckIcon /></span>
							{ point }
						</li>
					) ) }
				</ul>
				<div className="godam-onboarding__media-placeholder" aria-hidden="true" />
			</div>
		) : (
			<div className="godam-onboarding__aside-inner">
				<ul className="godam-onboarding__features">
					{ FEATURES.map( ( f ) => {
						const Icon = FEATURE_ICONS[ f.icon ];
						return (
							<li key={ f.title } className="godam-onboarding__feature">
								<span className="godam-onboarding__feature-chip"><Icon /></span>
								<span className="godam-onboarding__feature-text">
									<span className="godam-onboarding__feature-title">{ f.title }</span>
									<span className="godam-onboarding__feature-body">{ f.body }</span>
								</span>
							</li>
						);
					} ) }
				</ul>
			</div>
		) }
	</aside>
);

export default SidePanel;
