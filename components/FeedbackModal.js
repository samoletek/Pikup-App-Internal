import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    Animated,
    Dimensions,
    TextInput,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

const { height } = Dimensions.get('window');

/**
 * FeedbackModal - Customer rates driver after delivery completion
 * Follows Pikup-App design system (dark theme, purple accent)
 */
export default function FeedbackModal({
    visible,
    onClose,
    onSubmit,
    requestId,
    driverName = 'Driver',
    driverId,
}) {
    const [slideAnim] = useState(new Animated.Value(height));
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const { currentUser, saveFeedback } = useAuth();

    useEffect(() => {
        if (visible) {
            Animated.spring(slideAnim, {
                toValue: 0,
                useNativeDriver: true,
                tension: 100,
                friction: 8,
            }).start();
        } else {
            Animated.spring(slideAnim, {
                toValue: height,
                useNativeDriver: true,
                tension: 100,
                friction: 8,
            }).start();
        }
    }, [visible]);

    const handleClose = () => {
        Animated.spring(slideAnim, {
            toValue: height,
            useNativeDriver: true,
            tension: 100,
            friction: 8,
        }).start(() => {
            // Reset state
            setRating(5);
            setComment('');
            setSubmitted(false);
            onClose();
        });
    };

    const handleSubmit = async () => {
        if (isSubmitting) return;

        setIsSubmitting(true);

        try {
            const feedbackData = {
                requestId,
                driverId,
                customerId: currentUser?.uid,
                customerEmail: currentUser?.email,
                rating,
                comment: comment.trim(),
                timestamp: new Date().toISOString(),
                type: 'customer_to_driver', // Customer rating driver
            };

            // Save to Firebase
            if (saveFeedback) {
                await saveFeedback(feedbackData);
            }

            setSubmitted(true);

            // Call parent callback
            if (onSubmit) {
                onSubmit(feedbackData);
            }

            // Auto-close after showing success
            setTimeout(() => {
                handleClose();
            }, 2000);

        } catch (error) {
            console.error('Error submitting feedback:', error);
            // Still close on error - non-blocking
            handleClose();
        } finally {
            setIsSubmitting(false);
        }
    };

    const getRatingEmoji = () => {
        switch (rating) {
            case 5: return '🌟';
            case 4: return '😊';
            case 3: return '😐';
            case 2: return '😕';
            case 1: return '😞';
            default: return '⭐';
        }
    };

    const getRatingText = () => {
        switch (rating) {
            case 5: return 'Excellent!';
            case 4: return 'Very Good';
            case 3: return 'Good';
            case 2: return 'Fair';
            case 1: return 'Poor';
            default: return '';
        }
    };

    const quickFeedbackOptions = [
        { emoji: '⚡', text: 'Fast delivery' },
        { emoji: '📦', text: 'Items handled with care' },
        { emoji: '💬', text: 'Great communication' },
        { emoji: '😊', text: 'Friendly driver' },
    ];

    const [selectedQuickOptions, setSelectedQuickOptions] = useState([]);

    const toggleQuickOption = (text) => {
        setSelectedQuickOptions(prev =>
            prev.includes(text)
                ? prev.filter(t => t !== text)
                : [...prev, text]
        );
    };

    return (
        <Modal
            visible={visible}
            transparent={true}
            animationType="none"
            statusBarTranslucent={true}
            onRequestClose={handleClose}
        >
            {/* Backdrop */}
            <TouchableOpacity
                style={styles.backdrop}
                activeOpacity={1}
                onPress={handleClose}
            >
                <View style={styles.backdropOverlay} />
            </TouchableOpacity>

            {/* Modal Content */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <Animated.View
                    style={[
                        styles.modalContainer,
                        { transform: [{ translateY: slideAnim }] },
                    ]}
                >
                    {/* Handle */}
                    <View style={styles.handleContainer}>
                        <View style={styles.handle} />
                    </View>

                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.title}>Rate Your Delivery</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    {submitted ? (
                        // Success State
                        <View style={styles.successContainer}>
                            <View style={styles.successIcon}>
                                <Ionicons name="checkmark-circle" size={64} color="#00D4AA" />
                            </View>
                            <Text style={styles.successTitle}>Thank You! 🎉</Text>
                            <Text style={styles.successSubtitle}>
                                Your feedback helps us improve
                            </Text>
                        </View>
                    ) : (
                        // Feedback Form
                        <View style={styles.content}>
                            {/* Driver Info */}
                            <View style={styles.driverSection}>
                                <View style={styles.driverAvatar}>
                                    <Ionicons name="person" size={32} color="#A77BFF" />
                                </View>
                                <Text style={styles.driverName}>{driverName}</Text>
                                <Text style={styles.deliveryComplete}>Delivery Completed ✓</Text>
                            </View>

                            {/* Star Rating */}
                            <View style={styles.ratingSection}>
                                <Text style={styles.ratingPrompt}>How was your experience?</Text>
                                <View style={styles.starsContainer}>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <TouchableOpacity
                                            key={star}
                                            onPress={() => setRating(star)}
                                            style={styles.starButton}
                                        >
                                            <Ionicons
                                                name={star <= rating ? 'star' : 'star-outline'}
                                                size={40}
                                                color={star <= rating ? '#FFD700' : '#666'}
                                            />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <Text style={styles.ratingFeedback}>
                                    {getRatingEmoji()} {getRatingText()}
                                </Text>
                            </View>

                            {/* Quick Feedback Tags */}
                            <View style={styles.quickFeedbackSection}>
                                <Text style={styles.quickFeedbackTitle}>What went well?</Text>
                                <View style={styles.quickOptionsContainer}>
                                    {quickFeedbackOptions.map((option) => (
                                        <TouchableOpacity
                                            key={option.text}
                                            style={[
                                                styles.quickOption,
                                                selectedQuickOptions.includes(option.text) && styles.quickOptionSelected,
                                            ]}
                                            onPress={() => toggleQuickOption(option.text)}
                                        >
                                            <Text style={styles.quickOptionEmoji}>{option.emoji}</Text>
                                            <Text
                                                style={[
                                                    styles.quickOptionText,
                                                    selectedQuickOptions.includes(option.text) && styles.quickOptionTextSelected,
                                                ]}
                                            >
                                                {option.text}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Comment Input */}
                            <View style={styles.commentSection}>
                                <Text style={styles.commentLabel}>Additional Comments (Optional)</Text>
                                <TextInput
                                    style={styles.commentInput}
                                    placeholder="Tell us more about your experience..."
                                    placeholderTextColor="#666"
                                    multiline
                                    numberOfLines={3}
                                    value={comment}
                                    onChangeText={setComment}
                                    maxLength={250}
                                />
                                <Text style={styles.charCount}>{comment.length}/250</Text>
                            </View>
                        </View>
                    )}

                    {/* Submit Button */}
                    {!submitted && (
                        <View style={styles.bottomContainer}>
                            <TouchableOpacity
                                style={[
                                    styles.submitButton,
                                    isSubmitting && styles.submitButtonDisabled,
                                ]}
                                onPress={handleSubmit}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Ionicons name="send" size={20} color="#fff" style={{ marginRight: 8 }} />
                                        <Text style={styles.submitButtonText}>Submit Feedback</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.skipButton} onPress={handleClose}>
                                <Text style={styles.skipButtonText}>Skip for now</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </Animated.View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdropOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
    },
    keyboardView: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: '#1E1E2E',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: height * 0.9,
    },
    handleContainer: {
        alignItems: 'center',
        paddingTop: 12,
    },
    handle: {
        width: 40,
        height: 4,
        backgroundColor: '#3A3A4B',
        borderRadius: 2,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#2A2A3B',
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#2A2A3B',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    content: {
        padding: 20,
    },

    // Driver Section
    driverSection: {
        alignItems: 'center',
        marginBottom: 24,
    },
    driverAvatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#2A2A3B',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    driverName: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 4,
    },
    deliveryComplete: {
        color: '#00D4AA',
        fontSize: 14,
        fontWeight: '500',
    },

    // Rating Section
    ratingSection: {
        alignItems: 'center',
        marginBottom: 24,
    },
    ratingPrompt: {
        color: '#aaa',
        fontSize: 16,
        marginBottom: 16,
    },
    starsContainer: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    starButton: {
        padding: 4,
    },
    ratingFeedback: {
        color: '#A77BFF',
        fontSize: 18,
        fontWeight: '600',
    },

    // Quick Feedback Section
    quickFeedbackSection: {
        marginBottom: 20,
    },
    quickFeedbackTitle: {
        color: '#aaa',
        fontSize: 14,
        marginBottom: 12,
    },
    quickOptionsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    quickOption: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2A2A3B',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#3A3A4B',
    },
    quickOptionSelected: {
        backgroundColor: '#A77BFF20',
        borderColor: '#A77BFF',
    },
    quickOptionEmoji: {
        fontSize: 14,
        marginRight: 6,
    },
    quickOptionText: {
        color: '#aaa',
        fontSize: 12,
        fontWeight: '500',
    },
    quickOptionTextSelected: {
        color: '#A77BFF',
    },

    // Comment Section
    commentSection: {
        marginBottom: 8,
    },
    commentLabel: {
        color: '#aaa',
        fontSize: 14,
        marginBottom: 8,
    },
    commentInput: {
        backgroundColor: '#2A2A3B',
        borderRadius: 12,
        padding: 14,
        color: '#fff',
        fontSize: 14,
        textAlignVertical: 'top',
        minHeight: 80,
        borderWidth: 1,
        borderColor: '#3A3A4B',
    },
    charCount: {
        color: '#666',
        fontSize: 12,
        textAlign: 'right',
        marginTop: 4,
    },

    // Success State
    successContainer: {
        alignItems: 'center',
        padding: 40,
    },
    successIcon: {
        marginBottom: 16,
    },
    successTitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    successSubtitle: {
        color: '#aaa',
        fontSize: 16,
    },

    // Bottom Container
    bottomContainer: {
        padding: 20,
        paddingBottom: 40,
        borderTopWidth: 1,
        borderTopColor: '#2A2A3B',
    },
    submitButton: {
        backgroundColor: '#A77BFF',
        borderRadius: 25,
        paddingVertical: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#A77BFF',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    submitButtonDisabled: {
        opacity: 0.6,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    skipButton: {
        alignItems: 'center',
        paddingVertical: 12,
        marginTop: 8,
    },
    skipButtonText: {
        color: '#666',
        fontSize: 14,
    },
});
