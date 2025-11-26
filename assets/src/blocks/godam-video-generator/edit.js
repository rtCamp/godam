import { __ } from '@wordpress/i18n';
import
    {
        useBlockProps,
        InspectorControls,
        MediaUpload,
        MediaUploadCheck
    } from '@wordpress/block-editor';
import
    {
        PanelBody,
        SelectControl,
        RangeControl,
        TextControl,
        TextareaControl,
        Button,
        Notice,
        Spinner,
        Divider,
        Card,
        CardBody
    } from '@wordpress/components';
import { useState } from '@wordpress/element';

const ALLOWED_MEDIA_TYPES = [ 'image' ];

import './editor.scss';

export default function Edit( { attributes, setAttributes } )
{
    const {
        productImages = [],
        generatedVideoUrl = '',
        isGenerating = false,
        videoTitle = '',
        videoDescription = '',
        videoStyle = 'kling-1.0-pro',
        videoDuration = 15,
        apiKey = ''
    } = attributes;

    const [ error, setError ] = useState( '' );
    const [ progress, setProgress ] = useState( 0 );
    const [ validationErrors, setValidationErrors ] = useState( {} );

    const blockProps = useBlockProps( {
        className: 'wp-block-godam-video-generator'
    } );

    // Configuration options
    const videoStyleOptions = [
        { label: __( 'Realistic', 'godam-video-generator' ), value: 'kling-1.0-pro' },
        { label: __( 'Cinematic', 'godam-video-generator' ), value: 'kling-1.5' }
    ];

    // Validation functions
    const validateForm = () =>
    {
        const errors = {};

        if ( productImages.length === 0 )
        {
            errors.images = __( 'Please select at least one product image.', 'godam-video-generator' );
        }

        if ( !videoTitle.trim() )
        {
            errors.title = __( 'Video title is required.', 'godam-video-generator' );
        }

        if ( !videoDescription.trim() )
        {
            errors.description = __( 'Video description is required.', 'godam-video-generator' );
        }

        if ( !apiKey.trim() )
        {
            errors.apiKey = __( 'API key is required.', 'godam-video-generator' );
        }

        setValidationErrors( errors );
        return Object.keys( errors ).length === 0;
    };

    // Media handling
    const onSelectImages = ( media ) =>
    {
        const images = media.map( item => ( {
            id: item.id,
            url: item.url,
            alt: item.alt || '',
            caption: item.caption || '',
            filename: item.filename || ''
        } ) );
        setAttributes( { productImages: images } );
        setError( '' );

        // Clear validation error for images
        if ( validationErrors.images )
        {
            const newErrors = { ...validationErrors };
            delete newErrors.images;
            setValidationErrors( newErrors );
        }
    };

    const removeImage = ( indexToRemove ) =>
    {
        const updatedImages = productImages.filter( ( _, index ) => index !== indexToRemove );
        setAttributes( { productImages: updatedImages } );
    };

    // API call to Vyro AI
    const generateVideo = async () =>
    {
        if ( !validateForm() )
        {
            setError( __( 'Please fix the validation errors before generating video.', 'godam-video-generator' ) );
            return;
        }

        setAttributes( { isGenerating: true } );
        setError( '' );
        setProgress( 0 );

        try
        {
            // Progress simulation
            const progressInterval = setInterval( () =>
            {
                setProgress( prev =>
                {
                    if ( prev < 90 ) return prev + Math.random() * 15;
                    return prev;
                } );
            }, 2000 );

            // Convert image URL to blob for FormData
            const imageBlob = await fetch( productImages[0].url ).then( r => r.blob() );

            // Prepare form data for Vyro AI API
            const formData = new FormData();
            formData.append( 'style', videoStyle );
            formData.append( 'prompt', `${videoTitle}. ${videoDescription}` );
            formData.append( 'file', imageBlob, productImages[0].filename || 'image.jpg' );

            // Make request to Vyro AI API
            const response = await fetch( 'https://api.vyro.ai/v2/video/image-to-video', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${ apiKey }`,
                },
                body: formData
            } );

            const data = await response.json();

            clearInterval( progressInterval );
            setProgress( 100 );

            if ( response.ok && data.success )
            {
                setAttributes( {
                    generatedVideoUrl: data.video_url || data.videoUrl || data.url,
                    isGenerating: false
                } );
            } else
            {
                throw new Error( data.message || data.error || __( 'Video generation failed', 'godam-video-generator' ) );
            }

        } catch ( err )
        {
            console.error( 'Video generation error:', err );
            setError( err.message || __( 'An error occurred during video generation', 'godam-video-generator' ) );
            setAttributes( { isGenerating: false } );
            setProgress( 0 );
        }
    };

    const resetGeneration = () =>
    {
        setAttributes( { generatedVideoUrl: '' } );
        setProgress( 0 );
        setError( '' );
    };

    return (
        <>
            <InspectorControls>
                <PanelBody title={ __( 'Vyro AI Configuration', 'godam-video-generator' ) } initialOpen={ false }>
                    <TextControl
                        label={ __( 'Vyro AI API Key', 'godam-video-generator' ) }
                        value={ apiKey }
                        onChange={ ( value ) => setAttributes( { apiKey: value } ) }
                        type="password"
                        placeholder="vk-..."
                        help={ __( 'Your Vyro AI authentication key', 'godam-video-generator' ) }
                        className={ validationErrors.apiKey ? 'has-error' : '' }
                    />
                    { validationErrors.apiKey && (
                        <Notice status="error" isDismissible={ false }>
                            { validationErrors.apiKey }
                        </Notice>
                    ) }
                </PanelBody>

                <PanelBody title={ __( 'Video Settings', 'godam-video-generator' ) } initialOpen={ true }>
                    <SelectControl
                        label={ __( 'Vyro AI Style', 'godam-video-generator' ) }
                        value={ videoStyle }
                        options={ videoStyleOptions }
                        onChange={ ( value ) => setAttributes( { videoStyle: value } ) }
                        help={ __( 'Choose the Vyro AI style for video generation', 'godam-video-generator' ) }
                    />
                </PanelBody>

                <PanelBody title={ __( 'Content Settings', 'godam-video-generator' ) } initialOpen={ true }>
                    <TextControl
                        label={ __( 'Video Title', 'godam-video-generator' ) }
                        value={ videoTitle }
                        onChange={ ( value ) => setAttributes( { videoTitle: value } ) }
                        placeholder={ __( 'Enter video title...', 'godam-video-generator' ) }
                        className={ validationErrors.title ? 'has-error' : '' }
                    />
                    { validationErrors.title && (
                        <Notice status="error" isDismissible={ false }>
                            { validationErrors.title }
                        </Notice>
                    ) }

                    <TextareaControl
                        label={ __( 'Video Description/Prompt', 'godam-video-generator' ) }
                        value={ videoDescription }
                        onChange={ ( value ) => setAttributes( { videoDescription: value } ) }
                        placeholder={ __( 'Describe the video content and animation...', 'godam-video-generator' ) }
                        help={ __( 'This becomes the prompt for Vyro AI video generation', 'godam-video-generator' ) }
                        rows={ 4 }
                        className={ validationErrors.description ? 'has-error' : '' }
                    />
                    { validationErrors.description && (
                        <Notice status="error" isDismissible={ false }>
                            { validationErrors.description }
                        </Notice>
                    ) }
                </PanelBody>
            </InspectorControls>

            <div { ...blockProps }>
                <Card className="godam-video-generator-card">
                    <CardBody>
                        <div className="godam-video-generator-header">
                            <h3>{ __( 'Vyro AI Video Generator', 'godam-video-generator' ) }</h3>
                            <p className="description">
                                { __( 'Create engaging videos from your product images using Vyro AI', 'godam-video-generator' ) }
                            </p>
                        </div>

                        { error && (
                            <Notice status="error" isDismissible onRemove={ () => setError( '' ) }>
                                { error }
                            </Notice>
                        ) }

                        <div className="godam-image-section">
                            <h4>{ __( 'Product Image', 'godam-video-generator' ) }</h4>
                            <p className="description">
                                { __( 'Note: Vyro AI processes one image at a time. Select your main product image.', 'godam-video-generator' ) }
                            </p>

                            <MediaUploadCheck>
                                <MediaUpload
                                    onSelect={ ( media ) => onSelectImages( Array.isArray( media ) ? media : [ media ] ) }
                                    allowedTypes={ ALLOWED_MEDIA_TYPES }
                                    multiple={ false }
                                    gallery={ false }
                                    value={ productImages.length > 0 ? productImages[0].id : '' }
                                    render={ ( { open } ) => (
                                        <Button
                                            onClick={ open }
                                            variant="secondary"
                                            className="godam-upload-button"
                                            icon="camera"
                                        >
                                            { productImages.length === 0
                                                ? __( 'Select Product Image', 'godam-video-generator' )
                                                : __( 'Change Image', 'godam-video-generator' )
                                            }
                                        </Button>
                                    ) }
                                />
                            </MediaUploadCheck>

                            { validationErrors.images && (
                                <Notice status="error" isDismissible={ false }>
                                    { validationErrors.images }
                                </Notice>
                            ) }

                            { productImages.length > 0 && (
                                <div className="godam-selected-images">
                                    <div className="godam-image-grid">
                                        <div className="godam-image-item">
                                            <img src={ productImages[0].url } alt={ productImages[0].alt } />
                                            <Button
                                                onClick={ () => removeImage( 0 ) }
                                                variant="secondary"
                                                isDestructive
                                                size="small"
                                                className="godam-remove-image"
                                                icon="no-alt"
                                            >
                                                { __( 'Remove', 'godam-video-generator' ) }
                                            </Button>
                                            <div className="image-name">{ productImages[0].filename }</div>
                                        </div>
                                    </div>
                                </div>
                            ) }
                        </div>

                        <div className="godam-generation-section">
                            <Button
                                onClick={ generateVideo }
                                variant="primary"
                                disabled={ isGenerating }
                                className="godam-generate-button"
                                icon={ isGenerating ? "update" : "video-alt3" }
                            >
                                { isGenerating
                                    ? __( 'Generating Video...', 'godam-video-generator' )
                                    : __( 'Generate Video with Vyro AI', 'godam-video-generator' )
                                }
                            </Button>

                            { isGenerating && (
                                <div className="godam-generation-progress">
                                    <div className="progress-content">
                                        <Spinner />
                                        <div className="progress-text">
                                            <p>{ __( 'Processing image with Vyro AI...', 'godam-video-generator' ) }</p>
                                            <span className="progress-percentage">{ Math.round( progress ) }%</span>
                                        </div>
                                    </div>
                                    <div className="godam-progress-bar">
                                        <div
                                            className="godam-progress-fill"
                                            style={ { width: `${ progress }%` } }
                                        ></div>
                                    </div>
                                </div>
                            ) }
                        </div>

                        { generatedVideoUrl && (
                            <div className="godam-generated-video-section">
                                <h4>{ __( 'Generated Video', 'godam-video-generator' ) }</h4>
                                <div className="godam-video-container">
                                    <video
                                        controls
                                        className="godam-generated-video"
                                        poster=""
                                    >
                                        <source src={ generatedVideoUrl } type="video/mp4" />
                                        { __( 'Your browser does not support the video tag.', 'godam-video-generator' ) }
                                    </video>
                                </div>

                                <div className="godam-video-actions">
                                    <Button
                                        variant="secondary"
                                        onClick={ () => window.open( generatedVideoUrl, '_blank' ) }
                                        icon="download"
                                    >
                                        { __( 'Download Video', 'godam-video-generator' ) }
                                    </Button>

                                    <Button
                                        variant="tertiary"
                                        onClick={ resetGeneration }
                                        icon="update"
                                    >
                                        { __( 'Generate New Video', 'godam-video-generator' ) }
                                    </Button>
                                </div>
                            </div>
                        ) }

                        <div className="godam-info-section">
                            <div className="godam-style-info">
                                <strong>{ __( 'Vyro AI Style:', 'godam-video-generator' ) }</strong>{ ' ' }
                                { videoStyleOptions.find( opt => opt.value === videoStyle )?.label }
                            </div>
                        </div>
                    </CardBody>
                </Card>
            </div>
        </>
    );
}
