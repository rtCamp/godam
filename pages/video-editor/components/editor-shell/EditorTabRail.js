/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { LayersTabIcon, SettingsTabIcon, TranscriptTabIcon, ChaptersTabIcon } from './icons';

/**
 * Vertical icon rail that switches the active editor section.
 *
 * Replaces the previous horizontal `TabPanel`. The internal tab names are
 * kept identical to the existing Redux `currentTab` values so no behaviour
 * changes (`layers`, `player-settings`, `transcription`, `chapters`).
 *
 * @param {Object}   props
 * @param {string}   props.currentTab Active tab name.
 * @param {Function} props.onSelect   Called with the selected tab name.
 * @return {JSX.Element} The tab rail.
 */
const EditorTabRail = ( { currentTab, onSelect } ) => {
	const tabs = [
		{ name: 'layers', label: __( 'Layers', 'godam' ), icon: LayersTabIcon },
		{ name: 'player-settings', label: __( 'Settings', 'godam' ), icon: SettingsTabIcon },
		{ name: 'transcription', label: __( 'Transcription', 'godam' ), icon: TranscriptTabIcon },
		{ name: 'chapters', label: __( 'Chapters', 'godam' ), icon: ChaptersTabIcon },
	];

	return (
		<nav className="godam-video-editor__rail" aria-label={ __( 'Editor sections', 'godam' ) }>
			{ tabs.map( ( tab ) => (
				<Button
					key={ tab.name }
					className="godam-video-editor__rail-button"
					icon={ tab.icon }
					label={ tab.label }
					showTooltip
					isPressed={ currentTab === tab.name }
					aria-current={ currentTab === tab.name ? 'page' : undefined }
					onClick={ () => onSelect( tab.name ) }
				/>
			) ) }
		</nav>
	);
};

export default EditorTabRail;
