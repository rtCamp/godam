/**
 * WordPress dependencies
 */
import { Button, Flex, FlexItem, DropdownMenu, MenuGroup, MenuItem, Tooltip } from '@wordpress/components';
import { __, _n, sprintf } from '@wordpress/i18n';
import { arrowLeft, copy, seen, chartBar, moreVertical } from '@wordpress/icons';

/**
 * Top bar for the video editor shell.
 *
 * Renders the back button, video title + layer count, and the primary
 * actions (Copy, Preview, Save Video) plus a kebab menu (Analytics).
 * All handlers are passed in from `VideoEditor` so behaviour is unchanged.
 *
 * @param {Object}   props
 * @param {string}   props.title        Video title.
 * @param {number}   props.layerCount   Number of layers.
 * @param {number}   props.attachmentID Attachment ID for Preview/Analytics links.
 * @param {boolean}  props.isChanged    Whether there are unsaved changes.
 * @param {boolean}  props.isSaving     Whether a save is in progress.
 * @param {Function} props.onBack       Back-to-picker handler.
 * @param {Function} props.onSave       Save handler.
 * @param {Function} props.onCopy       Copy-block handler.
 * @return {JSX.Element} The top bar.
 */
const EditorTopBar = ( {
	title,
	layerCount,
	attachmentID,
	isChanged,
	isSaving,
	onBack,
	onSave,
	onCopy,
} ) => {
	const homeUrl = window?.godamRestRoute?.homeUrl || '';
	const hasValidApiKey = Boolean( window?.userData?.validApiKey );
	const previewUrl = `${ homeUrl }?godam_page=video-preview&id=${ attachmentID }`;
	const analyticsUrl = `${ homeUrl }/wp-admin/admin.php?page=rtgodam_analytics&id=${ attachmentID }`;

	return (
		<div className="godam-video-editor__topbar">
			<Flex justify="flex-start" align="center" gap={ 2 } expanded={ false }>
				<FlexItem>
					<Button
						icon={ arrowLeft }
						label={ __( 'Back to media library', 'godam' ) }
						onClick={ onBack }
					/>
				</FlexItem>
				<FlexItem>
					<h1 className="godam-video-editor__title">{ title }</h1>
					<p className="godam-video-editor__subtitle">
						{ sprintf(
							// translators: %d is the number of layers.
							_n( '%d layer', '%d layers', layerCount, 'godam' ),
							layerCount,
						) }
					</p>
				</FlexItem>
			</Flex>

			<Flex
				className="godam-video-editor__actions"
				justify="flex-end"
				align="center"
				gap={ 2 }
				expanded={ false }
			>
				<FlexItem>
					<Tooltip
						text={
							<p>
								{ __( 'You can copy the block into one of the two options:', 'godam' ) }
								<br />
								{ __( '1. Insert as a block in the Block editor.', 'godam' ) }
								<br />
								{ __( '2. Insert as HTML content in the Block editor.', 'godam' ) }
							</p>
						}
					>
						<Button
							variant="tertiary"
							icon={ copy }
							onClick={ onCopy }
							data-test-id="godam-video-editor-button-copy-block"
						>
							{ __( 'Copy', 'godam' ) }
						</Button>
					</Tooltip>
				</FlexItem>
				<FlexItem>
					<Button
						variant="tertiary"
						icon={ seen }
						href={ previewUrl }
						target="_blank"
						data-test-id="godam-video-editor-button-preview"
					>
						{ __( 'Preview', 'godam' ) }
					</Button>
				</FlexItem>
				<FlexItem>
					<Button
						variant="primary"
						onClick={ onSave }
						isBusy={ isSaving }
						disabled={ ! isChanged }
						data-test-id="godam-video-editor-button-save"
					>
						{ isSaving ? __( 'Saving…', 'godam' ) : __( 'Save Video', 'godam' ) }
					</Button>
				</FlexItem>
				{ hasValidApiKey && (
					<FlexItem>
						<DropdownMenu
							icon={ moreVertical }
							label={ __( 'More options', 'godam' ) }
						>
							{ () => (
								<MenuGroup>
									<MenuItem
										icon={ chartBar }
										href={ analyticsUrl }
										target="_blank"
										data-test-id="godam-video-editor-button-analytics"
									>
										{ __( 'Analytics', 'godam' ) }
									</MenuItem>
								</MenuGroup>
							) }
						</DropdownMenu>
					</FlexItem>
				) }
			</Flex>
		</div>
	);
};

export default EditorTopBar;
