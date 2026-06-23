/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import BrandLogo from '../BrandLogo';
import { config } from '../../utils/constants';

/**
 * O7 — post-connect welcome interstitial → hands off to the dashboard.
 */
const WelcomeScreen = () => (
	<div className="godam-onboarding__center">
		<BrandLogo markOnly />
		<h1 className="godam-onboarding__title">{ __( 'Welcome to GoDAM Pro!', 'godam' ) }</h1>
		<p className="godam-onboarding__subtitle">{ __( "You're all set. Upload videos to your WordPress Media Library and GoDAM auto-syncs them here.", 'godam' ) }</p>
		<Button
			variant="primary"
			className="godam-onb-btn godam-onb-btn--primary godam-onboarding__cta"
			href={ config.dashboardUrl || undefined }
			onClick={ ! config.dashboardUrl ? () => window.location.reload() : undefined }
			data-test-id="godam-onboarding-button-go-dashboard"
		>
			{ __( 'Go to dashboard', 'godam' ) }
		</Button>
	</div>
);

export default WelcomeScreen;
