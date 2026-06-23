/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * O2 — the shared marketing side panel.
 *
 * NOTE: all copy here is placeholder per design review (Joel) — final strings
 * come from the pricing page. Wrapped in __() so they're swappable.
 */
const HIGHLIGHTS = [
	{ key: 'sites', title: __( 'Sites', 'godam' ), body: __( 'Install on up to 10 WordPress instances.', 'godam' ) },
	{ key: 'bandwidth', title: __( 'Bandwidth', 'godam' ), body: __( 'Unlimited global delivery via our CDN.', 'godam' ) },
	{ key: 'team', title: __( 'Team', 'godam' ), body: __( 'Invite unlimited editors and contributors.', 'godam' ) },
	{ key: 'security', title: __( 'Security', 'godam' ), body: __( 'Enterprise-grade encryption.', 'godam' ) },
	{ key: 'storage', title: __( 'Storage', 'godam' ), body: __( 'Optimized SSD storage for cinematic video.', 'godam' ) },
];

const MarketingPanel = () => (
	<aside className="godam-onboarding__aside" data-test-id="godam-onboarding-panel-marketing">
		<div className="godam-onboarding__aside-inner">
			<p className="godam-onboarding__eyebrow">{ __( 'Used by forward-thinking teams', 'godam' ) }</p>
			<h2 className="godam-onboarding__aside-title">
				{ __( 'Drive conversions with AI-powered video tools', 'godam' ) }
			</h2>
			<p className="godam-onboarding__aside-sub">
				{ __( 'A scalable digital asset management platform for WordPress, optimized for conversion-driven video content.', 'godam' ) }
			</p>
			<ul className="godam-onboarding__highlights">
				{ HIGHLIGHTS.map( ( h ) => (
					<li key={ h.key } className="godam-onboarding__highlight">
						<span className="godam-onboarding__highlight-title">{ h.title }</span>
						<span className="godam-onboarding__highlight-body">{ h.body }</span>
					</li>
				) ) }
			</ul>
			<p className="godam-onboarding__social-proof">{ __( 'Join 3,400+ creators monetizing their content.', 'godam' ) }</p>
		</div>
	</aside>
);

export default MarketingPanel;
