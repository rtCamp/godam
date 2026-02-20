/**
 * Welcome walkthrough app.
 *
 * Uses the native @wordpress/components Guide component to walk first-time users
 * through all the features available in GoDAM — both free and Pro. After the guide
 * finishes, the user is redirected to the Dashboard.
 *
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
 * Pricing URL helper with UTM params.
 *
 * @param {string} utmContent - Identifying content tag for the link.
 * @return {string} Full pricing URL.
 */
const pricingUrl = ( utmContent ) => {
	const host = window?.godamWelcomeData?.host || window?.location?.host || '';
	return `https://godam.io/pricing?utm_campaign=welcome-walkthrough&utm_source=${ host }&utm_medium=plugin&utm_content=${ utmContent }`;
};

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

	// Redirect to GoDAM Dashboard.
	window.location.href = window?.godamWelcomeData?.dashboardUrl || '/wp-admin/admin.php?page=rtgodam';
};

/* -------------------------------------------------------------------------
 * Step Components
 * ---------------------------------------------------------------------- */

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
			{ __( 'Let\'s take a quick tour — starting with the features you can use right away for free, then a look at what\'s available with a Pro plan.', 'godam' ) }
		</p>
		<div className="godam-welcome__hero-badges">
			<span className="godam-welcome__tag godam-welcome__tag--free">{ __( 'Free features included', 'godam' ) }</span>
			<span className="godam-welcome__tag godam-welcome__tag--pro">{ __( 'Pro features previewed', 'godam' ) }</span>
		</div>
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
		<h2>
			{ __( 'Media Library Folders', 'godam' ) }
			<span className="godam-welcome__tag godam-welcome__tag--free">{ __( 'Free', 'godam' ) }</span>
		</h2>
		<p>
			{ __( 'WordPress doesn\'t support folders in the Media Library by default. GoDAM adds a folder overlay so you can organize all your media into a clean folder structure.', 'godam' ) }
		</p>
		<ul className="godam-welcome__feature-list">
			<li>{ __( 'Drag and drop media into folders', 'godam' ) }</li>
			<li>{ __( 'All existing media goes to an Uncategorized folder', 'godam' ) }</li>
			<li>{ __( 'File URLs stay the same — no broken links', 'godam' ) }</li>
			<li>{ __( 'Works with images, videos, audio, and documents', 'godam' ) }</li>
		</ul>
		<div className="godam-welcome__step-actions">
			<a
				href={ window?.godamWelcomeData?.mediaLibraryUrl || '/wp-admin/upload.php' }
				target="_blank"
				rel="noopener noreferrer"
				className="godam-welcome__action-link"
			>
				{ __( 'Open Media Library →', 'godam' ) }
			</a>
			<a
				href="https://godam.io/features/central-media-manager/?utm_source=plugin&utm_medium=welcome&utm_content=media-library"
				target="_blank"
				rel="noopener noreferrer"
				className="godam-welcome__action-link godam-welcome__action-link--secondary"
			>
				{ __( 'Learn more', 'godam' ) }
			</a>
		</div>
	</div>
);

/**
 * CTA and Hotspot Layers step — free video layers.
 *
 * @return {JSX.Element} Free layers overview.
 */
const FreeLayersStep = () => (
	<div className="godam-welcome__step">
		<div className="godam-welcome__step-icon">&#127916;</div>
		<h2>
			{ __( 'Interactive Video Layers', 'godam' ) }
			<span className="godam-welcome__tag godam-welcome__tag--free">{ __( 'Free', 'godam' ) }</span>
		</h2>
		<p>
			{ __( 'Make any video interactive with CTA and Hotspot overlays — no account required. Add them directly from the GoDAM Video Editor.', 'godam' ) }
		</p>
		<ul className="godam-welcome__feature-list godam-welcome__feature-list--two-col">
			<li>
				<strong>{ __( 'Call to Action (CTA)', 'godam' ) }</strong>
				<span>{ __( 'Show clickable buttons, images, or custom HTML at any point during playback', 'godam' ) }</span>
			</li>
			<li>
				<strong>{ __( 'Hotspots', 'godam' ) }</strong>
				<span>{ __( 'Place interactive markers anywhere on the video frame — link to any URL', 'godam' ) }</span>
			</li>
		</ul>
		<div className="godam-welcome__step-actions">
			<a
				href={ window?.godamWelcomeData?.videoEditorUrl || '/wp-admin/admin.php?page=rtgodam_video_editor' }
				target="_blank"
				rel="noopener noreferrer"
				className="godam-welcome__action-link"
			>
				{ __( 'Open Video Editor →', 'godam' ) }
			</a>
			<a
				href="https://godam.io/features/video-overlay/?utm_source=plugin&utm_medium=welcome&utm_content=free-layers"
				target="_blank"
				rel="noopener noreferrer"
				className="godam-welcome__action-link godam-welcome__action-link--secondary"
			>
				{ __( 'Learn more', 'godam' ) }
			</a>
		</div>
	</div>
);

/**
 * Pro Video Layers step — Forms, Ads, Polls.
 *
 * @return {JSX.Element} Pro layers overview.
 */
const ProLayersStep = () => (
	<div className="godam-welcome__step">
		<div className="godam-welcome__step-icon">&#128202;</div>
		<h2>
			{ __( 'Pro Video Layers', 'godam' ) }
			<span className="godam-welcome__tag godam-welcome__tag--pro">{ __( 'Pro', 'godam' ) }</span>
		</h2>
		<p>
			{ __( 'Turn passive viewers into active participants and monetize your videos with three powerful Pro layer types.', 'godam' ) }
		</p>
		<ul className="godam-welcome__feature-list godam-welcome__feature-list--pro">
			<li>
				<strong>{ __( 'Form Layer', 'godam' ) }</strong>
				<span>{ __( 'Embed Gravity Forms, WPForms, Fluent Forms, and more directly inside video', 'godam' ) }</span>
			</li>
			<li>
				<strong>{ __( 'Ad Layer', 'godam' ) }</strong>
				<span>{ __( 'Show pre-roll, mid-roll, or post-roll ads — or connect your own ad server (VAST)', 'godam' ) }</span>
			</li>
			<li>
				<strong>{ __( 'Poll Layer', 'godam' ) }</strong>
				<span>{ __( 'Add interactive polls to gather audience feedback during playback', 'godam' ) }</span>
			</li>
		</ul>
		<div className="godam-welcome__step-actions">
			<a
				href={ pricingUrl( 'pro-layers-step' ) }
				target="_blank"
				rel="noopener noreferrer"
				className="godam-welcome__action-link godam-welcome__action-link--pro"
			>
				{ __( 'Upgrade to unlock →', 'godam' ) }
			</a>
			<a
				href="https://godam.io/features/video-overlay/?utm_source=plugin&utm_medium=welcome&utm_content=pro-layers"
				target="_blank"
				rel="noopener noreferrer"
				className="godam-welcome__action-link godam-welcome__action-link--secondary"
			>
				{ __( 'Learn more', 'godam' ) }
			</a>
		</div>
	</div>
);

/**
 * Analytics step — Pro feature.
 *
 * @return {JSX.Element} Analytics feature overview.
 */
const AnalyticsStep = () => (
	<div className="godam-welcome__step">
		<div className="godam-welcome__step-icon">&#128200;</div>
		<h2>
			{ __( 'Video Analytics', 'godam' ) }
			<span className="godam-welcome__tag godam-welcome__tag--pro">{ __( 'Pro', 'godam' ) }</span>
		</h2>
		<p>
			{ __( 'Understand exactly how your audience engages with every video. Track plays, watch time, drop-off points, and layer interactions.', 'godam' ) }
		</p>
		<ul className="godam-welcome__feature-list godam-welcome__feature-list--pro">
			<li>{ __( 'Per-video play counts, watch time, and completion rates', 'godam' ) }</li>
			<li>{ __( 'Engagement heatmaps — see which moments viewers rewatch or skip', 'godam' ) }</li>
			<li>{ __( 'CTA clicks, form submissions, and poll vote tracking', 'godam' ) }</li>
			<li>{ __( 'Side-by-side comparison of multiple videos', 'godam' ) }</li>
		</ul>
		<div className="godam-welcome__step-actions">
			<a
				href={ pricingUrl( 'analytics-step' ) }
				target="_blank"
				rel="noopener noreferrer"
				className="godam-welcome__action-link godam-welcome__action-link--pro"
			>
				{ __( 'Upgrade to unlock →', 'godam' ) }
			</a>
			<a
				href="https://godam.io/features/analytics/?utm_source=plugin&utm_medium=welcome&utm_content=analytics"
				target="_blank"
				rel="noopener noreferrer"
				className="godam-welcome__action-link godam-welcome__action-link--secondary"
			>
				{ __( 'Learn more', 'godam' ) }
			</a>
		</div>
	</div>
);

/**
 * Transcoding, CDN & Branding step — Pro feature.
 *
 * @return {JSX.Element} Transcoding and CDN feature overview.
 */
const TranscodingStep = () => (
	<div className="godam-welcome__step">
		<div className="godam-welcome__step-icon">&#9889;</div>
		<h2>
			{ __( 'Transcoding, CDN & Player Branding', 'godam' ) }
			<span className="godam-welcome__tag godam-welcome__tag--pro">{ __( 'Pro', 'godam' ) }</span>
		</h2>
		<p>
			{ __( 'Deliver lightning-fast, beautifully branded videos to every viewer — automatically optimized for their device and connection speed.', 'godam' ) }
		</p>
		<ul className="godam-welcome__feature-list godam-welcome__feature-list--pro">
			<li>{ __( 'Automatic transcoding to multiple resolutions (360p – 4K)', 'godam' ) }</li>
			<li>{ __( 'Global CDN delivery for fast load times worldwide', 'godam' ) }</li>
			<li>{ __( 'HLS adaptive streaming for smooth playback on any connection', 'godam' ) }</li>
			<li>{ __( 'Custom player logo, colors, and branding', 'godam' ) }</li>
		</ul>
		<div className="godam-welcome__step-actions">
			<a
				href={ pricingUrl( 'transcoding-step' ) }
				target="_blank"
				rel="noopener noreferrer"
				className="godam-welcome__action-link godam-welcome__action-link--pro"
			>
				{ __( 'Upgrade to unlock →', 'godam' ) }
			</a>
			<a
				href={ window?.godamWelcomeData?.settingsUrl || '/wp-admin/admin.php?page=rtgodam_settings' }
				target="_blank"
				rel="noopener noreferrer"
				className="godam-welcome__action-link godam-welcome__action-link--secondary"
			>
				{ __( 'Connect API key →', 'godam' ) }
			</a>
		</div>
	</div>
);

/* -------------------------------------------------------------------------
 * App
 * ---------------------------------------------------------------------- */

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
					{ content: <FreeLayersStep /> },
					{ content: <ProLayersStep /> },
					{ content: <AnalyticsStep /> },
					{ content: <TranscodingStep /> },
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
