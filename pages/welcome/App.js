/**
 * Welcome walkthrough app.
 *
 * Uses the native @wordpress/components Guide component to walk first-time users
 * through the free features available in GoDAM. After the guide finishes, the user
 * is redirected to the Dashboard (the What's New page will show automatically if
 * the transient is set — see class-update.php).
 */

/**
 * WordPress dependencies
 */
import { useState } from '@wordpress/element';
import { Guide, Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import GoDAMLogoImg from '../../assets/src/images/godam-logo.png';

/**
 * Marks the welcome walkthrough as completed via the REST API,
 * then redirects to the GoDAM Dashboard.
 */
const completeWelcome = async () => {
	try {
		await fetch( `${ window?.godamRestRoute?.url || '/wp-json/' }godam/v1/settings/welcome-complete`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': window?.godamWelcomeData?.nonce || '',
			},
		} );
	} catch ( err ) {
		// Silently fail — worst case the walkthrough shows again.
		// eslint-disable-next-line no-console
		console.error( 'GoDAM: Failed to save welcome state', err );
	}

	// Redirect to GoDAM Dashboard. If the rtgodam_show_whats_new transient is set
	// (fresh install), the PHP redirect will send the user to What's New first.
	window.location.href = window?.godamWelcomeData?.dashboardUrl || '/wp-admin/admin.php?page=rtgodam';
};

/**
 * Welcome step — hero introduction.
 *
 * @return {JSX.Element} Welcome page content.
 */
const WelcomeStep = () => (
	<div className="godam-welcome__step godam-welcome__step--hero">
		<img
			src={ GoDAMLogoImg }
			alt={ __( 'GoDAM Logo', 'godam' ) }
			className="godam-welcome__logo"
		/>
		<h1>{ __( 'Welcome to GoDAM', 'godam' ) }</h1>
		<p className="godam-welcome__tagline">
			{ __( 'Manage, edit, and deliver media directly from your WordPress dashboard.', 'godam' ) }
		</p>
		<p className="godam-welcome__subtitle">
			{ __( 'Let\'s take a quick look at the features you can start using right away — no account required.', 'godam' ) }
		</p>
	</div>
);

/**
 * Media Library Folders step.
 *
 * @return {JSX.Element} Media Library feature overview.
 */
const MediaLibraryStep = () => (
	<div className="godam-welcome__step">
		<div className="godam-welcome__step-icon">&#128193;</div>
		<h2>{ __( 'Media Library Folders', 'godam' ) }</h2>
		<p>
			{ __( 'WordPress doesn\'t support folders in the Media Library by default. GoDAM adds a folder overlay so you can organize all your media — images, videos, documents — into a clean folder structure.', 'godam' ) }
		</p>
		<ul className="godam-welcome__feature-list">
			<li>{ __( 'Drag and drop media into folders', 'godam' ) }</li>
			<li>{ __( 'Existing media goes into an Uncategorized folder', 'godam' ) }</li>
			<li>{ __( 'URLs stay the same — no broken links', 'godam' ) }</li>
		</ul>
	</div>
);

/**
 * CTA Layer step.
 *
 * @return {JSX.Element} CTA feature overview.
 */
const CTAStep = () => (
	<div className="godam-welcome__step">
		<div className="godam-welcome__step-icon">&#127919;</div>
		<h2>{ __( 'Video Layers: Call to Action', 'godam' ) }</h2>
		<p>
			{ __( 'Add interactive Call-to-Action overlays to your videos. Drive engagement by showing clickable buttons, images, or custom HTML at any point during video playback.', 'godam' ) }
		</p>
		<ul className="godam-welcome__feature-list">
			<li>{ __( 'Image, Text, and HTML CTA types', 'godam' ) }</li>
			<li>{ __( 'Set display timing and duration', 'godam' ) }</li>
			<li>{ __( 'Unlimited videos — completely free', 'godam' ) }</li>
		</ul>
	</div>
);

/**
 * Hotspot Layer step.
 *
 * @return {JSX.Element} Hotspot feature overview.
 */
const HotspotStep = () => (
	<div className="godam-welcome__step">
		<div className="godam-welcome__step-icon">&#128205;</div>
		<h2>{ __( 'Video Layers: Hotspots', 'godam' ) }</h2>
		<p>
			{ __( 'Place interactive hotspot markers on your videos. Link them to URLs, pages, or content so viewers can click and explore while watching.', 'godam' ) }
		</p>
		<ul className="godam-welcome__feature-list">
			<li>{ __( 'Position hotspots anywhere on the video', 'godam' ) }</li>
			<li>{ __( 'Customizable icons and tooltips', 'godam' ) }</li>
			<li>{ __( 'Unlimited videos — completely free', 'godam' ) }</li>
		</ul>
	</div>
);

/**
 * Pro Features teaser step.
 *
 * @return {JSX.Element} Premium features overview.
 */
const ProFeaturesStep = () => (
	<div className="godam-welcome__step">
		<div className="godam-welcome__step-icon">&#128142;</div>
		<h2>{ __( 'Unlock More with GoDAM Pro', 'godam' ) }</h2>
		<p>
			{ __( 'GoDAM Pro adds powerful video layers, analytics, transcoding, and performance features to take your media experience to the next level.', 'godam' ) }
		</p>
		<ul className="godam-welcome__feature-list godam-welcome__feature-list--pro">
			<li>{ __( 'Forms, Polls, and Ads video layers', 'godam' ) }</li>
			<li>{ __( 'Video analytics and engagement tracking', 'godam' ) }</li>
			<li>{ __( 'Video transcoding and CDN delivery', 'godam' ) }</li>
			<li>{ __( 'Player branding and customization', 'godam' ) }</li>
		</ul>
		<p className="godam-welcome__pro-note">
			{ __( 'You can enter your API key anytime in Settings > Video Settings.', 'godam' ) }
		</p>
	</div>
);

/**
 * Main App component.
 * Renders the Guide walkthrough. On finish/close, marks onboarding complete
 * and redirects to the Dashboard.
 *
 * @return {JSX.Element} The welcome walkthrough.
 */
const App = () => {
	const [ isGuideVisible, setIsGuideVisible ] = useState( true );

	const handleFinish = () => {
		setIsGuideVisible( false );
		completeWelcome();
	};

	// Fallback for users who somehow close the Guide without finishing.
	if ( ! isGuideVisible ) {
		return (
			<div className="godam-welcome__fallback">
				<p>{ __( 'Redirecting to Dashboard…', 'godam' ) }</p>
			</div>
		);
	}

	return (
		<div className="godam-welcome">
			<Guide
				onFinish={ handleFinish }
				className="godam-welcome__guide"
				contentLabel={ __( 'GoDAM Welcome Guide', 'godam' ) }
				finishButtonText={ __( 'Get Started', 'godam' ) }
				pages={ [
					{ content: <WelcomeStep /> },
					{ content: <MediaLibraryStep /> },
					{ content: <CTAStep /> },
					{ content: <HotspotStep /> },
					{ content: <ProFeaturesStep /> },
				] }
			/>
			<div className="godam-welcome__skip">
				<Button
					variant="link"
					onClick={ handleFinish }
				>
					{ __( 'Skip walkthrough', 'godam' ) }
				</Button>
			</div>
		</div>
	);
};

export default App;
