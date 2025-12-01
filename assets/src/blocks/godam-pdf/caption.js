/**
 * External dependencies
 */
import clsx from 'clsx';

/**
 * WordPress dependencies
 */
import { useState, useEffect, useCallback } from '@wordpress/element';
import { usePrevious } from '@wordpress/compose';
import { __ } from '@wordpress/i18n';
import {
	BlockControls,
} from '@wordpress/block-editor';
import { TextControl, ToolbarButton } from '@wordpress/components';
import { caption as captionIcon } from '@wordpress/icons';

/**
 * Renders a caption for a PDF block.
 *
 * @function
 * @since 1.0.0
 * @param {Object}      props                           - Component props.
 * @param {string}      [props.attributeKey]            - Attribute key on the block to store the caption.
 * @param {Object}      props.attributes                - Block attributes.
 * @param {Function}    props.setAttributes             - Function to update block attributes.
 * @param {boolean}     props.isSelected                - Whether the block is currently selected.
 * @param {Function}    props.insertBlocksAfter         - Function to insert blocks after the current block.
 * @param {string}      [props.placeholder]             - Placeholder text for the caption.
 * @param {boolean}     [props.showToolbarButton]       - Whether to show the toolbar button to toggle the caption.
 * @param {string}      [props.excludeElementClassName] - Class name to exclude from the caption element.
 * @param {string}      [props.className]               - Class name for the caption element.
 * @param {string}      [props.addLabel]                - Label for the "Add caption" button.
 * @param {string}      [props.removeLabel]             - Label for the "Remove caption" button.
 * @param {JSX.Element} [props.icon]                    - Icon for the caption button.
 * @return {JSX.Element} The rendered caption component.
 */
export function Caption( {
	attributeKey = 'caption',
	attributes,
	setAttributes,
	isSelected,
	insertBlocksAfter,
	placeholder = __( 'Add caption', 'godam' ),
	showToolbarButton = true,
	excludeElementClassName,
	className,
	addLabel = __( 'Add caption', 'godam' ),
	removeLabel = __( 'Remove caption', 'godam' ),
	icon = captionIcon,
	...props
} ) {
	const caption = attributes[ attributeKey ];
	const prevCaption = usePrevious( caption );
	const isCaptionEmpty = caption === '';
	const isPrevCaptionEmpty = prevCaption === '';
	const [ showCaption, setShowCaption ] = useState( ! isCaptionEmpty );

	useEffect( () => {
		if ( ! isCaptionEmpty && isPrevCaptionEmpty ) {
			setShowCaption( true );
		}
	}, [ isCaptionEmpty, isPrevCaptionEmpty ] );

	useEffect( () => {
		if ( ! isSelected && isCaptionEmpty ) {
			setShowCaption( false );
		}
	}, [ isSelected, isCaptionEmpty ] );

	// Focus the caption when we click to add one.
	const ref = useCallback(
		( node ) => {
			if ( node && isCaptionEmpty ) {
				node.focus();
			}
		},
		[ isCaptionEmpty ],
	);

	return (
		<>
			{ showToolbarButton && (
				<BlockControls group="block">
					<ToolbarButton
						onClick={ () => {
							setShowCaption( ! showCaption );
							if ( showCaption && caption ) {
								setAttributes( {
									[ attributeKey ]: undefined,
								} );
							}
						} }
						icon={ icon }
						isPressed={ showCaption }
						label={ showCaption ? removeLabel : addLabel }
					/>
				</BlockControls>
			) }
			{ showCaption && (
				<TextControl
					className={ clsx(
						className,
						excludeElementClassName
							? ''
							: 'rtgodam-pdf-caption',
					) }
					ref={ ref }
					placeholder={ placeholder }
					value={ caption }
					onChange={ ( value ) => {
						setAttributes( { [ attributeKey ]: value } );
					} }
					{ ...props }
				/>
			) }
		</>
	);
}
