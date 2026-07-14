/**
 * WordPress dependencies
 */
import { createBlock } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import {
	useBlockProps,
	InspectorControls,
	InnerBlocks,
	MediaUpload,
	MediaUploadCheck,
	store as blockEditorStore,
} from '@wordpress/block-editor';
import {
	PanelBody,
	RadioControl,
	RangeControl,
	SelectControl,
	ToggleControl,
	FormTokenField,
	DatePicker,
	Popover,
	Notice,
	Spinner,
	Button,
	__experimentalToggleGroupControl as ToggleGroupControl,
	__experimentalToggleGroupControlOption as ToggleGroupControlOption,
	__experimentalToggleGroupControlOptionIcon as ToggleGroupControlOptionIcon,
} from '@wordpress/components';
import { useDispatch, useSelect, select as dataSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { store as noticesStore } from '@wordpress/notices';
import { useCallback, useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { columns, grid, listView, plus, trash } from '@wordpress/icons';

/**
 * External dependencies
 */
import {
	DndContext,
	closestCenter,
	PointerSensor,
	useSensor,
	useSensors,
	DragOverlay,
} from '@dnd-kit/core';
import {
	SortableContext,
	verticalListSortingStrategy,
	useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * Internal dependencies
 */
import './editor.scss';

const ALLOWED_BLOCKS = [ 'godam/gallery-v2-item' ];

const performanceModeHelpText = {
	balanced: __( 'Recommended for most videos. Loads thumbnails as visitors scroll and prepares the video just before they reach it.', 'godam' ),
	priority: __( 'For hero videos above the fold. Loads the thumbnail immediately and prepares the video for the fastest possible first play. Use sparingly.', 'godam' ),
};

const formatDisplayDate = ( dateString ) => {
	if ( ! dateString ) {
		return '';
	}

	const date = new Date( dateString );

	return date.toLocaleDateString( 'en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	} );
};

const getStoredDateValue = ( dateString, type ) => {
	if ( ! dateString ) {
		return '';
	}

	const date = new Date( dateString );
	const year = date.getFullYear();
	const month = date.getMonth();
	const day = date.getDate();

	if ( type === 'start' ) {
		return new Date( year, month, day, 0, 0, 0, 0 ).toISOString();
	}

	return new Date( year, month, day, 23, 59, 59, 999 ).toISOString();
};

const getRelativeDate = ( days ) => {
	const date = new Date();
	date.setDate( date.getDate() - days );
	date.setHours( 0, 0, 0, 0 );
	return date.toISOString();
};

const parseIdList = ( value = '' ) =>
	value
		.split( ',' )
		.map( ( item ) => item.trim() )
		.filter( Boolean );

const getVideoThumbnail = ( media ) =>
	media?.meta?.rtgodam_media_video_thumbnail ||
	media?.media_details?.sizes?.medium?.source_url ||
	media?.media_details?.sizes?.thumbnail?.source_url ||
	media?.icon ||
	'';

const normalizeTokenValue = ( value = '' ) => value.trim().toLowerCase();

const resolveBlockGap = ( style ) => {
	const raw = style?.spacing?.blockGap;

	if ( ! raw ) {
		return '16px';
	}

	if ( typeof raw === 'string' && raw.startsWith( 'var:preset|spacing|' ) ) {
		return `var(--wp--preset--spacing--${ raw.replace( 'var:preset|spacing|', '' ) })`;
	}

	return raw;
};

const getPreviewQueryArgs = ( attributes ) => {
	const {
		count,
		orderby,
		order,
		mediaFolder,
		author,
		dateRange,
		customDateStart,
		customDateEnd,
	} = attributes;

	const mediaFolderIds = parseIdList( mediaFolder )
		.map( ( value ) => parseInt( value, 10 ) )
		.filter( ( value ) => ! Number.isNaN( value ) && value > 0 );
	const authorIds = parseIdList( author )
		.map( ( value ) => parseInt( value, 10 ) )
		.filter( ( value ) => ! Number.isNaN( value ) && value > 0 );
	const queryArgs = {
		per_page: count,
		orderby,
		order,
		status: 'inherit',
		media_type: 'video',
	};

	if ( mediaFolderIds.length ) {
		queryArgs[ 'media-folder' ] = mediaFolderIds.join( ',' );
	}

	if ( authorIds.length ) {
		queryArgs.author = authorIds.join( ',' );
	}

	if ( dateRange === '7days' ) {
		queryArgs.after = getRelativeDate( 7 );
	}

	if ( dateRange === '30days' ) {
		queryArgs.after = getRelativeDate( 30 );
	}

	if ( dateRange === '90days' ) {
		queryArgs.after = getRelativeDate( 90 );
	}

	if ( dateRange === 'custom' ) {
		if ( customDateStart ) {
			queryArgs.after = customDateStart;
		}

		if ( customDateEnd ) {
			queryArgs.before = customDateEnd;
		}
	}

	return queryArgs;
};

// ── Video list item in inspector panel ───────────────────────────────────────

function VideoListItemContent( { block, onRemove, dragHandleProps = {}, isDragging = false } ) {
	const { media } = useSelect(
		( select ) => {
			const videoId = block.attributes?.videoId;
			if ( ! videoId ) {
				return { media: null };
			}
			return { media: select( coreStore ).getMedia( videoId ) };
		},
		[ block.attributes?.videoId ],
	);

	const thumbnail = getVideoThumbnail( media );
	const title = media?.title?.rendered || __( 'Loading…', 'godam' );
	const date = formatDisplayDate( media?.date );

	return (
		<div className={ `godam-gallery-v2__video-item${ isDragging ? ' is-dragging' : '' }` }>
			<span
				className="godam-gallery-v2__drag-handle"
				data-test-id={ `godam-gallery-v2-element-drag-handle-${ block.clientId }` }
				{ ...dragHandleProps }
			>
				<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
					<circle cx="6.5" cy="5" r="1.5" fill="currentColor" />
					<circle cx="11.5" cy="5" r="1.5" fill="currentColor" />
					<circle cx="6.5" cy="9" r="1.5" fill="currentColor" />
					<circle cx="11.5" cy="9" r="1.5" fill="currentColor" />
					<circle cx="6.5" cy="13" r="1.5" fill="currentColor" />
					<circle cx="11.5" cy="13" r="1.5" fill="currentColor" />
				</svg>
			</span>
			<div className="godam-gallery-v2__video-thumb-wrap">
				{ thumbnail ? (
					<img
						src={ thumbnail }
						alt=""
						className="godam-gallery-v2__video-thumb"
					/>
				) : (
					<span className="dashicons dashicons-video-alt2 godam-gallery-v2__video-thumb-fallback" />
				) }
			</div>
			<div className="godam-gallery-v2__video-meta">
				<span className="godam-gallery-v2__video-name" title={ title }>
					{ title }
				</span>
				{ date && (
					<span className="godam-gallery-v2__video-date">{ date }</span>
				) }
			</div>
			<Button
				icon={ trash }
				label={ __( 'Remove', 'godam' ) }
				isDestructive
				size="small"
				onClick={ onRemove }
				data-test-id={ `godam-gallery-v2-button-remove-video-${ block.clientId }` }
			/>
		</div>
	);
}

function VideoListItem( { block, onRemove } ) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable( { id: block.clientId } );

	const style = {
		transform: CSS.Transform.toString( transform ),
		transition,
		opacity: isDragging ? 0.4 : 1,
	};

	return (
		<div ref={ setNodeRef } style={ style }>
			<VideoListItemContent
				block={ block }
				onRemove={ onRemove }
				dragHandleProps={ { ...attributes, ...listeners } }
				isDragging={ isDragging }
			/>
		</div>
	);
}

// ── AddVideoAppender used inside canvas ──────────────────────────────────────

const AddVideoAppender = ( { onSelect } ) => (
	<MediaUploadCheck>
		<MediaUpload
			allowedTypes={ [ 'video' ] }
			multiple
			onSelect={ onSelect }
			render={ ( { open } ) => (
				<Button
					className="godam-gallery-v2__add-video-button"
					variant="secondary"
					onClick={ open }
					icon={ plus }
					label={ __( 'Add New Video', 'godam' ) }
					showTooltip
					aria-label={ __( 'Add New Video', 'godam' ) }
				/>
			) }
		/>
	</MediaUploadCheck>
);

// ── Main Edit component ───────────────────────────────────────────────────────

export default function Edit( { attributes, setAttributes, clientId } ) {
	const {
		mode,
		itemWidth,
		count,
		orderby,
		order,
		viewRatio,
		infiniteScroll,
		enableMoreItems,
		moreItemsBehavior,
		mediaFolder,
		author,
		dateRange,
		customDateStart,
		customDateEnd,
		showTitle,
		layout,
		performanceMode,
		engagements,
		autoplay,
		showPlayButton,
	} = attributes;

	const engagementFeatureEnabled = window?.godamSettings?.engagementFeatureEnabled ?? false;
	const showEngagementSetting =
		engagementFeatureEnabled && ( window?.godamSettings?.enableGlobalVideoEngagement ?? false );

	const [ startDatePopoverOpen, setStartDatePopoverOpen ] = useState( false );
	const [ endDatePopoverOpen, setEndDatePopoverOpen ] = useState( false );
	const [ dateError, setDateError ] = useState( '' );

	const { insertBlocks, updateBlockAttributes, removeBlock, moveBlockToPosition } = useDispatch( blockEditorStore );
	const { createNotice } = useDispatch( noticesStore );

	const pendingVirtualInserts = useRef( [] );

	const { mediaFolders, authors, queryPreviewVideos, wasJustInserted, handpickedBlocks } =
		useSelect(
			( select ) => {
				const coreSelect = select( coreStore );
				const blockEditorSelect = select( blockEditorStore );
				const queryArgs = getPreviewQueryArgs( attributes );

				return {
					mediaFolders: coreSelect.getEntityRecords( 'taxonomy', 'media-folder', {
						per_page: -1,
					} ),
					authors: coreSelect.getUsers( { per_page: -1 } ),
					queryPreviewVideos:
						mode === 'query'
							? coreSelect.getEntityRecords( 'postType', 'attachment', queryArgs )
							: [],
					wasJustInserted:
						blockEditorSelect.wasBlockJustInserted( clientId, 'inserter' ) ||
						blockEditorSelect.wasBlockJustInserted( clientId, 'directInsert' ) ||
						blockEditorSelect.wasBlockJustInserted( clientId, 'transform' ),
					handpickedBlocks:
						mode === 'handpicked'
							? ( blockEditorSelect.getBlocks( clientId ) || [] )
							: [],
				};
			},
			[ attributes, clientId, mode ],
		);

	// ── Drag-and-drop (defined after useSelect so handpickedBlocks is in scope) ──

	const [ activeId, setActiveId ] = useState( null );

	const sensors = useSensors(
		useSensor( PointerSensor, {
			activationConstraint: { distance: 5 },
		} ),
	);

	const handleDragStart = useCallback( ( { active } ) => {
		setActiveId( active.id );
	}, [] );

	const handleDragEnd = useCallback(
		( { active, over } ) => {
			setActiveId( null );
			if ( ! over || active.id === over.id ) {
				return;
			}
			const oldIndex = handpickedBlocks.findIndex( ( b ) => b.clientId === active.id );
			const newIndex = handpickedBlocks.findIndex( ( b ) => b.clientId === over.id );
			if ( oldIndex === -1 || newIndex === -1 ) {
				return;
			}
			moveBlockToPosition( active.id, clientId, clientId, newIndex );
		},
		[ handpickedBlocks, clientId, moveBlockToPosition ],
	);

	useEffect( () => {
		if (
			mode !== 'query' ||
			! wasJustInserted ||
			typeof enableMoreItems !== 'undefined' ||
			typeof moreItemsBehavior !== 'undefined'
		) {
			return;
		}

		setAttributes( {
			enableMoreItems: false,
			moreItemsBehavior: 'button',
			infiniteScroll: false,
		} );
	}, [ enableMoreItems, infiniteScroll, mode, moreItemsBehavior, setAttributes, wasJustInserted ] );

	const resolvedEnableMoreItems =
		typeof enableMoreItems === 'boolean' ? enableMoreItems : true;
	const isCarouselLayout = layout === 'carousel';
	const resolvedMoreItemsBehavior =
		isCarouselLayout && resolvedEnableMoreItems
			? 'infinite'
			: moreItemsBehavior || ( infiniteScroll ? 'infinite' : 'button' );

	const updateMoreItemsSettings = (
		nextEnableMoreItems,
		nextBehavior = resolvedMoreItemsBehavior,
	) => {
		const behavior =
			isCarouselLayout && nextEnableMoreItems ? 'infinite' : nextBehavior;

		setAttributes( {
			enableMoreItems: nextEnableMoreItems,
			moreItemsBehavior: behavior,
			infiniteScroll: nextEnableMoreItems && behavior === 'infinite',
		} );
	};

	useEffect( () => {
		if (
			mode !== 'query' ||
			! isCarouselLayout ||
			! resolvedEnableMoreItems ||
			moreItemsBehavior === 'infinite' ||
			infiniteScroll
		) {
			return;
		}

		setAttributes( {
			moreItemsBehavior: 'infinite',
			infiniteScroll: true,
		} );
	}, [
		infiniteScroll,
		isCarouselLayout,
		mode,
		moreItemsBehavior,
		resolvedEnableMoreItems,
		setAttributes,
	] );

	const blockGap = resolveBlockGap( attributes.style );

	const itemWidthMap = { S: 200, M: 260, L: 320 };
	const itemWidthPx = itemWidthMap[ itemWidth ] || itemWidthMap.M;

	const blockProps = useBlockProps( {
		className: `godam-gallery-v2 godam-gallery-v2--${ mode }`,
		style: {
			'--godam-gallery-item-width': `${ itemWidthPx }px`,
			'--godam-gallery-gap': blockGap,
		},
	} );

	const mediaFolderOptions = useMemo(
		() =>
			( mediaFolders || [] ).map( ( folder ) => ( {
				id: folder.id.toString(),
				value: folder.name,
			} ) ),
		[ mediaFolders ],
	);

	const authorOptions = useMemo(
		() =>
			( authors || [] ).map( ( item ) => ( {
				id: item.id,
				value: item.name,
			} ) ),
		[ authors ],
	);

	const selectedMediaFolderToken = useMemo(
		() =>
			parseIdList( mediaFolder )
				.map(
					( id ) =>
						mediaFolderOptions.find( ( option ) => option.id === id )?.value,
				)
				.filter( Boolean ),
		[ mediaFolder, mediaFolderOptions ],
	);

	const selectedAuthorToken = useMemo(
		() =>
			parseIdList( author )
				.map(
					( id ) =>
						authorOptions.find( ( option ) => `${ option.id }` === id )?.value,
				)
				.filter( Boolean ),
		[ author, authorOptions ],
	);

	const mediaFolderSuggestions = useMemo(
		() => mediaFolderOptions.map( ( option ) => option.value ),
		[ mediaFolderOptions ],
	);

	const authorSuggestions = useMemo(
		() => authorOptions.map( ( option ) => option.value ),
		[ authorOptions ],
	);

	const insertHandpickedVideo = useCallback(
		( mediaItemOrArray ) => {
			const items = Array.isArray( mediaItemOrArray )
				? mediaItemOrArray
				: [ mediaItemOrArray ];
			if ( ! items.length ) {
				return;
			}

			const { getBlock } = dataSelect( blockEditorStore );
			const parentBlock = getBlock( clientId );
			const existingVideoIds = new Set(
				( parentBlock?.innerBlocks || [] )
					.map( ( block ) => block.attributes?.videoId )
					.filter( Boolean ),
			);

			const newBlocks = [];
			let skippedNonVideo = false;
			let skippedDuplicate = false;

			items.forEach( ( mediaItem ) => {
				if ( ! mediaItem?.id ) {
					return;
				}

				// Check the MIME string, not `mediaItem.type`: uploads report
				// the REST post type ("attachment") there, which would wrongly
				// skip freshly uploaded videos. `mime` is set on library
				// selections, `mime_type` on uploads.
				const mimeString = mediaItem.mime || mediaItem.mime_type || '';
				if ( mimeString && ! mimeString.startsWith( 'video/' ) ) {
					skippedNonVideo = true;
					return;
				}

				const numericId = parseInt( mediaItem.id, 10 );
				const isVirtual = ! (
					numericId > 0 && String( numericId ) === String( mediaItem.id )
				);

				if ( ! isVirtual ) {
					if ( existingVideoIds.has( numericId ) ) {
						skippedDuplicate = true;
						return;
					}
					existingVideoIds.add( numericId );
				}

				const newBlock = createBlock( 'godam/gallery-v2-item', {
					videoId: isVirtual ? 0 : numericId,
				} );

				if ( isVirtual ) {
					pendingVirtualInserts.current.push( {
						virtualId: mediaItem.id,
						blockClientId: newBlock.clientId,
					} );
				}

				newBlocks.push( newBlock );
			} );

			if ( skippedNonVideo ) {
				createNotice(
					'warning',
					__( 'Only video files can be added to the gallery.', 'godam' ),
					{ type: 'snackbar', isDismissible: true },
				);
			}

			if ( skippedDuplicate ) {
				createNotice(
					'warning',
					__( 'Duplicate videos were skipped.', 'godam' ),
					{ type: 'snackbar', isDismissible: true },
				);
			}

			if ( newBlocks.length > 0 ) {
				insertBlocks( newBlocks, undefined, clientId );
			}
		},
		[ clientId, createNotice, insertBlocks ],
	);

	useEffect( () => {
		const handleVirtualAttachmentCreated = ( event ) => {
			const { attachment, virtualMediaId } = event.detail || {};
			if ( ! attachment?.id || ! virtualMediaId ) {
				return;
			}

			const idx = pendingVirtualInserts.current.findIndex(
				( entry ) => String( entry.virtualId ) === String( virtualMediaId ),
			);

			if ( idx === -1 ) {
				return;
			}

			const [ { blockClientId } ] = pendingVirtualInserts.current.splice( idx, 1 );

			const { getBlock } = dataSelect( blockEditorStore );
			const parentBlock = getBlock( clientId );
			const isDuplicate = ( parentBlock?.innerBlocks || [] ).some(
				( block ) =>
					block.clientId !== blockClientId &&
					block.attributes?.videoId === attachment.id,
			);
			if ( isDuplicate ) {
				createNotice(
					'warning',
					__( 'Duplicate videos were skipped.', 'godam' ),
					{ type: 'snackbar', isDismissible: true },
				);
				removeBlock( blockClientId );
				return;
			}

			updateBlockAttributes( blockClientId, { videoId: attachment.id } );
		};
		document.addEventListener(
			'godam-virtual-attachment-created',
			handleVirtualAttachmentCreated,
		);
		return () => {
			document.removeEventListener(
				'godam-virtual-attachment-created',
				handleVirtualAttachmentCreated,
			);
		};
	}, [ clientId, createNotice, removeBlock, updateBlockAttributes ] );

	const renderVideoAppender = useCallback(
		() => <AddVideoAppender onSelect={ insertHandpickedVideo } />,
		[ insertHandpickedVideo ],
	);

	const updateMediaFolderToken = ( tokens ) => {
		if ( ! tokens.length ) {
			setAttributes( { mediaFolder: '' } );
			return;
		}

		const selectedIds = tokens
			.map(
				( token ) =>
					mediaFolderOptions.find(
						( option ) =>
							normalizeTokenValue( option.value ) ===
							normalizeTokenValue( token ),
					)?.id,
			)
			.filter( Boolean );
		setAttributes( { mediaFolder: selectedIds.join( ',' ) } );
	};

	const updateAuthorToken = ( tokens ) => {
		if ( ! tokens.length ) {
			setAttributes( { author: '' } );
			return;
		}

		const selectedIds = tokens
			.map(
				( token ) =>
					authorOptions.find(
						( option ) =>
							normalizeTokenValue( option.value ) ===
							normalizeTokenValue( token ),
					)?.id,
			)
			.filter( Boolean );
		setAttributes( { author: selectedIds.join( ',' ) } );
	};

	const previewItems = useMemo( () => {
		if ( mode !== 'query' || ! Array.isArray( queryPreviewVideos ) ) {
			return [];
		}

		return queryPreviewVideos.map( ( video ) => ( {
			id: video.id,
			title: video.title?.rendered || __( 'Untitled video', 'godam' ),
			date: video.date,
			thumbnail: getVideoThumbnail( video ),
		} ) );
	}, [ mode, queryPreviewVideos ] );

	const handleDateChange = ( nextDate, type ) => {
		if ( ! nextDate ) {
			setDateError( '' );
			setAttributes( {
				[ type === 'start' ? 'customDateStart' : 'customDateEnd' ]: '',
			} );
			return;
		}

		const selectedDate = new Date( nextDate );
		selectedDate.setHours( 0, 0, 0, 0 );
		const compareDate = new Date(
			type === 'start' ? customDateEnd : customDateStart,
		);
		if ( ! Number.isNaN( compareDate.getTime() ) ) {
			compareDate.setHours( 0, 0, 0, 0 );
		}

		if ( ! Number.isNaN( compareDate.getTime() ) ) {
			if ( type === 'start' && selectedDate > compareDate ) {
				setDateError( __( 'Start date cannot be later than end date.', 'godam' ) );
				return;
			}

			if ( type === 'end' && selectedDate < compareDate ) {
				setDateError( __( 'End date cannot be earlier than start date.', 'godam' ) );
				return;
			}
		}

		setDateError( '' );
		setAttributes( {
			[ type === 'start' ? 'customDateStart' : 'customDateEnd' ]:
				getStoredDateValue( nextDate, type ),
		} );
	};

	const hasHandpickedVideos = handpickedBlocks.length > 0;

	return (
		<>
			<InspectorControls>

				{ /* ── Source ─────────────────────────────────────────────── */ }
				<PanelBody
					title={ __( 'Source', 'godam' ) }
					initialOpen={ true }
					data-test-id="godam-gallery-v2-panel-source"
				>
					<ToggleGroupControl
						__nextHasNoMarginBottom
						isBlock
						label={ __( 'Gallery Source', 'godam' ) }
						data-test-id="godam-gallery-v2-control-mode"
						value={ mode }
						onChange={ ( value ) => {
							if ( value ) {
								setAttributes( { mode: value } );
							}
						} }
					>
						<ToggleGroupControlOption
							value="handpicked"
							label={ __( 'Handpicked', 'godam' ) }
						/>
						<ToggleGroupControlOption
							value="query"
							label={ __( 'Query', 'godam' ) }
						/>
					</ToggleGroupControl>
				</PanelBody>

				{ /* ── Video Selection (handpicked only) ───────────────────── */ }
				{ mode === 'handpicked' && (
					<PanelBody
						title={ __( 'Video Selection', 'godam' ) }
						initialOpen={ true }
						data-test-id="godam-gallery-v2-panel-video-selection"
					>
						<p className="godam-gallery-v2__panel-hint">
							{ __( 'Videos play on mute by default', 'godam' ) }
						</p>

						{ handpickedBlocks.length > 0 && (
							<DndContext
								sensors={ sensors }
								collisionDetection={ closestCenter }
								onDragStart={ handleDragStart }
								onDragEnd={ handleDragEnd }
							>
								<SortableContext
									items={ handpickedBlocks.map( ( b ) => b.clientId ) }
									strategy={ verticalListSortingStrategy }
								>
									<div className="godam-gallery-v2__video-list">
										{ handpickedBlocks.map( ( block ) => (
											<VideoListItem
												key={ block.clientId }
												block={ block }
												onRemove={ () => removeBlock( block.clientId ) }
											/>
										) ) }
									</div>
								</SortableContext>
								<DragOverlay>
									{ activeId ? (
										<VideoListItemContent
											block={ handpickedBlocks.find( ( b ) => b.clientId === activeId ) }
											onRemove={ () => {} }
											isDragging
										/>
									) : null }
								</DragOverlay>
							</DndContext>
						) }

						<MediaUploadCheck>
							<MediaUpload
								allowedTypes={ [ 'video' ] }
								multiple
								onSelect={ insertHandpickedVideo }
								render={ ( { open } ) => (
									<Button
										variant="secondary"
										onClick={ open }
										className="godam-gallery-v2__add-video-btn"
										data-test-id="godam-gallery-v2-button-add-video"
									>
										{ __( '+ Add Video', 'godam' ) }
									</Button>
								) }
							/>
						</MediaUploadCheck>
					</PanelBody>
				) }

				{ /* ── Gallery Settings ────────────────────────────────────── */ }
				<PanelBody
					title={ __( 'Gallery Settings', 'godam' ) }
					initialOpen={ true }
					data-test-id="godam-gallery-v2-panel-settings"
				>
					<ToggleGroupControl
						__nextHasNoMarginBottom
						isBlock
						label={ __( 'Layout', 'godam' ) }
						data-test-id="godam-gallery-v2-control-layout"
						value={ layout }
						onChange={ ( value ) => {
							if ( ! value ) {
								return;
							}

							if ( value === 'carousel' && resolvedEnableMoreItems ) {
								setAttributes( {
									layout: value,
									moreItemsBehavior: 'infinite',
									infiniteScroll: true,
								} );
								return;
							}

							setAttributes( { layout: value } );
						} }
					>
						<ToggleGroupControlOptionIcon
							icon={ columns }
							label={ __( 'Carousel', 'godam' ) }
							value="carousel"
						/>
						<ToggleGroupControlOptionIcon
							icon={ grid }
							label={ __( 'Grid', 'godam' ) }
							value="grid"
						/>
						<ToggleGroupControlOptionIcon
							icon={ listView }
							label={ __( 'List', 'godam' ) }
							value="list"
						/>
					</ToggleGroupControl>

					<ToggleGroupControl
						__nextHasNoMarginBottom
						isBlock
						label={ __( 'View Ratio', 'godam' ) }
						data-test-id="godam-gallery-v2-control-view-ratio"
						value={ viewRatio }
						onChange={ ( value ) =>
							value && setAttributes( { viewRatio: value } )
						}
					>
						<ToggleGroupControlOption label="4:3" value="4:3" />
						<ToggleGroupControlOption label="9:16" value="9:16" />
						<ToggleGroupControlOption label="3:4" value="3:4" />
						<ToggleGroupControlOption label="1:1" value="1:1" />
						<ToggleGroupControlOption label="16:9" value="16:9" />
					</ToggleGroupControl>

					<ToggleGroupControl
						__nextHasNoMarginBottom
						isBlock
						label={ __( 'Item Size', 'godam' ) }
						data-test-id="godam-gallery-v2-control-item-width"
						value={ itemWidth }
						onChange={ ( value ) =>
							value && setAttributes( { itemWidth: value } )
						}
						help={ __( 'Size of each gallery item.', 'godam' ) }
					>
						<ToggleGroupControlOption label={ __( 'S', 'godam' ) } value="S" />
						<ToggleGroupControlOption label={ __( 'M', 'godam' ) } value="M" />
						<ToggleGroupControlOption label={ __( 'L', 'godam' ) } value="L" />
					</ToggleGroupControl>
				</PanelBody>

				{ /* ── Info Display ─────────────────────────────────────────── */ }
				<PanelBody title={ __( 'Info Display', 'godam' ) } initialOpen={ true } data-test-id="godam-gallery-v2-panel-info-display">
					<RadioControl
						label={ __( 'Info Display', 'godam' ) }
						hideLabelFromVision
						selected={ showTitle ? 'title' : 'image' }
						options={ [
							{
								label: __( 'Only Image', 'godam' ),
								value: 'image',
							},
							{
								label: __( 'Show Video Title and Date', 'godam' ),
								value: 'title',
							},
						] }
						onChange={ ( value ) =>
							setAttributes( { showTitle: value === 'title' } )
						}
						data-test-id="godam-gallery-v2-control-show-title"
					/>
				</PanelBody>

				{ /* ── Interaction ──────────────────────────────────────────── */ }
				<PanelBody title={ __( 'Interaction', 'godam' ) } initialOpen={ true } data-test-id="godam-gallery-v2-panel-interaction">
					<div data-test-id="godam-gallery-v2-control-interaction">
						<RadioControl
							className="godam-gallery-v2__interaction-radio"
							label={ __( 'Interaction', 'godam' ) }
							hideLabelFromVision
							selected={ autoplay ? 'autoplay' : 'hover' }
							options={ [
								{
									label: __( 'Autoplay all videos', 'godam' ),
									value: 'autoplay',
									description: __( 'Visible videos autoplay one at a time and continue through the full video.', 'godam' ),
								},
								{
									label: __( 'Play on hover', 'godam' ),
									value: 'hover',
									description: __( 'Videos will play when hovered over', 'godam' ),
								},
							] }
							onChange={ ( value ) =>
								setAttributes( {
									autoplay: value === 'autoplay',
									playOnHover: value === 'hover',
								} )
							}
						/>
					</div>

					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Show play button', 'godam' ) }
						checked={ showPlayButton !== false }
						onChange={ ( value ) => setAttributes( { showPlayButton: value } ) }
						data-test-id="godam-gallery-v2-control-show-play-button"
						help={ showPlayButton !== false
							? __( 'Play button overlay is visible on each tile.', 'godam' )
							: __( 'Play button overlay is hidden.', 'godam' )
						}
					/>
				</PanelBody>

				{ /* ── Performance ──────────────────────────────────────────── */ }
				<PanelBody title={ __( 'Performance', 'godam' ) } initialOpen={ true } data-test-id="godam-gallery-v2-panel-performance">
					<ToggleGroupControl
						__nextHasNoMarginBottom
						isBlock
						label={ __( 'Performance', 'godam' ) }
						hideLabelFromVision
						data-test-id="godam-gallery-v2-control-performance"
						value={ performanceMode || 'balanced' }
						onChange={ ( value ) =>
							value && setAttributes( { performanceMode: value } )
						}
						help={ performanceModeHelpText[ performanceMode || 'balanced' ] }
					>
						<ToggleGroupControlOption
							label={ __( 'Priority', 'godam' ) }
							value="priority"
						/>
						<ToggleGroupControlOption
							label={ __( 'Balanced', 'godam' ) }
							value="balanced"
						/>
					</ToggleGroupControl>
				</PanelBody>

				{ /* ── Engagements (conditional) ────────────────────────────── */ }
				{ showEngagementSetting && (
					<PanelBody title={ __( 'Engagement', 'godam' ) } initialOpen={ false } data-test-id="godam-gallery-v2-panel-engagement">
						<ToggleControl
							label={ __( 'Enable Likes & Comments', 'godam' ) }
							checked={ !! engagements }
							onChange={ ( value ) => setAttributes( { engagements: value } ) }
							help={ __(
								'Engagement will only be visible for transcoded videos',
								'godam',
							) }
						/>
					</PanelBody>
				) }

				{ /* ── Query Settings (query mode only) ────────────────────── */ }
				{ mode === 'query' && (
					<PanelBody
						title={ __( 'Query Settings', 'godam' ) }
						initialOpen={ true }
						data-test-id="godam-gallery-v2-panel-query"
					>
						<RangeControl
							label={ __( 'Number of videos', 'godam' ) }
							data-test-id="godam-gallery-v2-control-count"
							value={ count }
							onChange={ ( value ) => setAttributes( { count: value } ) }
							min={ 1 }
							max={ 30 }
						/>
						<div className="godam-gallery-v2__query-row">
							<div className="godam-gallery-v2__query-col">
								<SelectControl
									label={ __( 'Order by', 'godam' ) }
									value={ orderby }
									options={ [
										{ label: __( 'Date', 'godam' ), value: 'date' },
										{ label: __( 'Title', 'godam' ), value: 'title' },
									] }
									onChange={ ( value ) =>
										setAttributes( { orderby: value } )
									}
								/>
							</div>
							<div className="godam-gallery-v2__query-col">
								<SelectControl
									label={ __( 'Order', 'godam' ) }
									value={ order }
									options={ [
										{
											label: __( 'Descending', 'godam' ),
											value: 'desc',
										},
										{
											label: __( 'Ascending', 'godam' ),
											value: 'asc',
										},
									] }
									onChange={ ( value ) => setAttributes( { order: value } ) }
								/>
							</div>
						</div>

						<FormTokenField
							className="media-folder-token-field"
							label={ __( 'Media Folder', 'godam' ) }
							value={ selectedMediaFolderToken }
							suggestions={ mediaFolderSuggestions }
							onChange={ updateMediaFolderToken }
							placeholder={ __( 'Search and select media folders', 'godam' ) }
							__experimentalShowHowTo={ false }
						/>

						<FormTokenField
							className="author-token-field"
							label={ __( 'Author', 'godam' ) }
							value={ selectedAuthorToken }
							suggestions={ authorSuggestions }
							onChange={ updateAuthorToken }
							placeholder={ __( 'Search and select authors', 'godam' ) }
							__experimentalShowHowTo={ false }
						/>

						<SelectControl
							label={ __( 'Date Range', 'godam' ) }
							value={ dateRange }
							options={ [
								{ label: __( 'All Time', 'godam' ), value: '' },
								{ label: __( 'Last 7 Days', 'godam' ), value: '7days' },
								{ label: __( 'Last 30 Days', 'godam' ), value: '30days' },
								{ label: __( 'Last 90 Days', 'godam' ), value: '90days' },
								{
									label: __( 'Custom Range', 'godam' ),
									value: 'custom',
								},
							] }
							onChange={ ( value ) =>
								setAttributes( {
									dateRange: value,
									customDateStart:
										value === 'custom' ? customDateStart : '',
									customDateEnd: value === 'custom' ? customDateEnd : '',
								} )
							}
						/>

						{ dateRange === 'custom' && (
							<div className="godam-gallery-v2__date-range-picker">
								{ dateError && (
									<Notice status="error" isDismissible={ false }>
										{ dateError }
									</Notice>
								) }
								<div className="godam-gallery-v2__date-field">
									<label htmlFor="godam-gallery-v2-start-date">
										{ __( 'Start Date', 'godam' ) }
									</label>
									<button
										id="godam-gallery-v2-start-date"
										type="button"
										className={ `godam-gallery-v2__date-button ${ dateError ? 'has-error' : '' }` }
										onClick={ () => setStartDatePopoverOpen( true ) }
									>
										{ customDateStart
											? formatDisplayDate( customDateStart )
											: __( 'Select Start Date', 'godam' ) }
									</button>
									{ startDatePopoverOpen && (
										<Popover
											position="bottom left"
											onClose={ () => setStartDatePopoverOpen( false ) }
										>
											<DatePicker
												currentDate={ customDateStart }
												onChange={ ( value ) => {
													handleDateChange( value, 'start' );
													setStartDatePopoverOpen( false );
												} }
												maxDate={ customDateEnd || undefined }
											/>
										</Popover>
									) }
								</div>
								<div className="godam-gallery-v2__date-field">
									<label htmlFor="godam-gallery-v2-end-date">
										{ __( 'End Date', 'godam' ) }
									</label>
									<button
										id="godam-gallery-v2-end-date"
										type="button"
										className={ `godam-gallery-v2__date-button ${ dateError ? 'has-error' : '' }` }
										onClick={ () => setEndDatePopoverOpen( true ) }
									>
										{ customDateEnd
											? formatDisplayDate( customDateEnd )
											: __( 'Select End Date', 'godam' ) }
									</button>
									{ endDatePopoverOpen && (
										<Popover
											position="bottom left"
											onClose={ () => setEndDatePopoverOpen( false ) }
										>
											<DatePicker
												currentDate={ customDateEnd }
												onChange={ ( value ) => {
													handleDateChange( value, 'end' );
													setEndDatePopoverOpen( false );
												} }
												minDate={ customDateStart || undefined }
											/>
										</Popover>
									) }
								</div>
							</div>
						) }

						<div data-test-id="godam-gallery-v2-control-enable-more-items">
							<ToggleControl
								label={ __( 'Enable More Items', 'godam' ) }
								checked={ !! resolvedEnableMoreItems }
								onChange={ ( value ) => updateMoreItemsSettings( value ) }
							/>
						</div>
						{ resolvedEnableMoreItems && (
							<SelectControl
								label={ __( 'More Items Behavior', 'godam' ) }
								value={ resolvedMoreItemsBehavior }
								options={ [
									{
										label: __( 'Load More Button', 'godam' ),
										value: 'button',
									},
									{
										label: __( 'Infinite Scroll', 'godam' ),
										value: 'infinite',
									},
								] }
								disabled={ isCarouselLayout }
								help={
									isCarouselLayout
										? __( 'Carousel layout always uses Infinite Scroll when more items are enabled.', 'godam' )
										: __( 'Choose how visitors load more videos in query galleries.', 'godam' )
								}
								onChange={ ( value ) =>
									updateMoreItemsSettings( true, value )
								}
							/>
						) }
					</PanelBody>
				) }

			</InspectorControls>

			{ /* ── Block Canvas ──────────────────────────────────────────────── */ }
			<div { ...blockProps } data-test-id="godam-gallery-v2-canvas">

				{ /* Handpicked mode */ }
				{ mode === 'handpicked' && (
					<div
						className={ `godam-gallery-v2__canvas godam-gallery-v2__canvas--${ layout }` }
						data-test-id="godam-gallery-v2-canvas-handpicked"
						data-show-play-button={ showPlayButton !== false ? 'true' : 'false' }
					>
						{ /* Custom empty state shown when no videos are selected */ }
						{ ! hasHandpickedVideos && (
							<div className="godam-gallery-v2__empty-state">
								<div className="godam-gallery-v2__empty-tiles">
									{ [ ...Array( 6 ) ].map( ( _, i ) => (
										<div
											key={ i }
											className="godam-gallery-v2__empty-tile"
											aria-hidden="true"
										/>
									) ) }
								</div>
								<h3 className="godam-gallery-v2__empty-heading">
									{ __( 'Create your media gallery', 'godam' ) }
								</h3>
								<p className="godam-gallery-v2__empty-desc">
									{ __( 'Upload or select videos to add to your gallery.', 'godam' ) }
								</p>
								<MediaUploadCheck>
									<MediaUpload
										allowedTypes={ [ 'video' ] }
										multiple
										onSelect={ insertHandpickedVideo }
										render={ ( { open } ) => (
											<Button
												variant="primary"
												onClick={ open }
												className="godam-gallery-v2__empty-btn"
												data-test-id="godam-gallery-v2-button-empty-add-video"
											>
												{ __( '+ Add Video', 'godam' ) }
											</Button>
										) }
									/>
								</MediaUploadCheck>
								{ /* InnerBlocks always mounted so block tree stays registered */ }
								<div className="godam-gallery-v2__inner-blocks-mount">
									<InnerBlocks
										allowedBlocks={ ALLOWED_BLOCKS }
										renderAppender={ false }
									/>
								</div>
							</div>
						) }

						{ /* Videos list */ }
						{ hasHandpickedVideos && (
							<InnerBlocks
								allowedBlocks={ ALLOWED_BLOCKS }
								orientation={
									layout === 'carousel' ? 'horizontal' : 'vertical'
								}
								renderAppender={ renderVideoAppender }
							/>
						) }
					</div>
				) }

				{ /* Query mode */ }
				{ mode === 'query' && (
					<div
						className={ `godam-gallery-v2__canvas godam-gallery-v2__canvas--${ layout }` }
						data-test-id="godam-gallery-v2-canvas-query"
						data-show-play-button={ showPlayButton !== false ? 'true' : 'false' }
					>
						{ queryPreviewVideos === null && (
							<div className="godam-gallery-v2__state godam-gallery-v2__state--loading">
								<Spinner />
								<span>{ __( 'Loading matching videos…', 'godam' ) }</span>
							</div>
						) }

						{ Array.isArray( queryPreviewVideos ) &&
							queryPreviewVideos.length === 0 && (
							<div className="godam-gallery-v2__state">
								<strong>{ __( 'No videos found', 'godam' ) }</strong>
								<p>
									{ __(
										'Try changing the selected folder, author, or dates.',
										'godam',
									) }
								</p>
							</div>
						) }

						{ Array.isArray( previewItems ) && previewItems.length > 0 && (
							<div className="godam-gallery-v2__query-list">
								{ previewItems.map( ( video ) => (
									<div
										className={ `godam-gallery-v2__query-item godam-gallery-v2__query-item--ratio-${ viewRatio.replace( ':', '-' ) }` }
										key={ video.id }
										data-test-id={ `godam-gallery-v2-element-query-item-${ video.id }` }
									>
										<div className="godam-gallery-v2__query-thumb">
											{ video.thumbnail ? (
												<img
													src={ video.thumbnail }
													alt={ video.title }
												/>
											) : (
												<span data-test-id="godam-gallery-v2-element-thumbnail-fallback">
													{ __( 'Video', 'godam' ) }
												</span>
											) }
											{ showPlayButton !== false && (
												<div className="godam-gallery-v2__play-icon" aria-hidden="true">
													<svg viewBox="0 0 24 24" fill="currentColor">
														<path d="M8 5v14l11-7z" />
													</svg>
												</div>
											) }
										</div>
										{ showTitle && (
											<div className="godam-gallery-v2__query-meta">
												<strong>{ video.title }</strong>
												<span>{ formatDisplayDate( video.date ) }</span>
											</div>
										) }
									</div>
								) ) }
							</div>
						) }
					</div>
				) }

			</div>
		</>
	);
}
