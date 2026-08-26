/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';

/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';
import { ToggleControl } from '@wordpress/components';

/**
 * Internal dependencies
 */
import GodamHeader from '../godam/components/GoDAMHeader.jsx';
import GoDAMFooter from '../godam/components/GoDAMFooter.jsx';
import { useSaveMediaSettingsMutation, useGetMediaSettingsQuery } from '../godam/redux/api/media-settings.js';
import { updateMediaSetting } from '../godam/redux/slice/media-settings.js';
import { getHubSections } from './constants';
import DocsSearch from './components/DocsSearch';
import HubCard from './components/HubCard';

const App = () => {
	const dispatch = useDispatch();
	const { mediaSettings } = useSelector( ( state ) => ( {
		mediaSettings: state.mediaSettings,
	} ) );

	const { isLoading: isSettingsLoading } = useGetMediaSettingsQuery();
	const [ saveMediaSettings ] = useSaveMediaSettingsMutation();

	const handlePostHogToggle = async ( value ) => {
		dispatch( updateMediaSetting( { category: 'general', key: 'enable_posthog_tracking', value } ) );
		dispatch( updateMediaSetting( { category: 'general', key: 'posthog_initialized', value: true } ) );

		// Save immediately since it's a single toggle in help page
		const updatedSettings = {
			...mediaSettings,
			general: {
				...mediaSettings.general,
				enable_posthog_tracking: value,
				posthog_initialized: true,
			},
		};
		await saveMediaSettings( { settings: updatedSettings } );
	};

	const sections = getHubSections();

	return (
		<div className="godam-help-container">
			<GodamHeader />

			<div className="godam-help-hero">
				<div className="godam-help-hero__inner">
					<p className="godam-help-eyebrow">{ __( 'Documentation', 'godam' ) }</p>
					<h1 className="godam-help-hero__title">
						{ __( 'What are you building with GoDAM?', 'godam' ) }
					</h1>
					<p className="godam-help-hero__subtitle">
						{ __( 'Pick where you use GoDAM — or search across every hub.', 'godam' ) }
					</p>
					<DocsSearch />
				</div>
			</div>

			<div className="godam-help-sections">
				{ sections.map( ( section ) => (
					<section key={ section.id } className="godam-help-section">
						<p className="godam-help-eyebrow">{ section.label }</p>
						<p className="godam-help-section__description">{ section.description }</p>

						<div className="godam-help-grid">
							{ section.hubs.map( ( hub ) => (
								<HubCard key={ hub.id } hub={ hub } />
							) ) }
						</div>
					</section>
				) ) }
			</div>

			<div className="godam-help-tracking">
				<div className="godam-help-tracking__inner">
					<div>
						<h4 className="godam-help-tracking__title">
							{ __( 'Help us improve GoDAM', 'godam' ) }
						</h4>
						<p className="godam-help-tracking__description">
							{ __( 'Allows the GoDAM plugin to track anonymous events for analytics purposes. This helps us improve the product experience.', 'godam' ) }
						</p>
					</div>
					<ToggleControl
						__nextHasNoMarginBottom
						className="godam-toggle-small mb-0"
						checked={ mediaSettings?.general?.enable_posthog_tracking }
						onChange={ handlePostHogToggle }
						disabled={ isSettingsLoading }
					/>
				</div>
			</div>

			<GoDAMFooter />
		</div>
	);
};

export default App;
