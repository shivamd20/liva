# Excalidraw Mobile & Tablet Optimizations

This document outlines all the mobile and tablet optimizations implemented for the Excalidraw integration in Liva.

## Overview

The BoardEditor component has been transformed into a premium, mobile-responsive component that provides an excellent user experience across all devices - mobile phones, tablets, and desktops.

## Key Improvements

### 1. **Viewport Control** (`index.html`)
```html
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
```
- Prevents browser pinch-zoom which conflicts with Excalidraw's canvas zoom
- Excalidraw handles its own internal zooming, so browser zoom is disabled
- Ensures consistent behavior across iOS and Android

### 2. **Responsive Layout** (`BoardEditor.tsx`)
```tsx
<div className="excalidraw-wrapper">
  <Excalidraw UIOptions={uiOptions} ... />
</div>
```
- Fixed positioning with `inset-0` ensures full viewport coverage
- Flex layout adapts to all screen sizes
- No reliance on browser quirks for sizing

### 3. **Dynamic UI Configuration**

#### Mobile (< 768px)
- Simplified UI with minimal canvas actions
- Docked sidebar (always visible)
- Disabled: background color change, export options
- Optimized for touch interactions

#### Tablet (768px - 1024px)
- Balanced UI with moderate features
- Responsive sidebar docking
- Better touch targets

#### Desktop (> 1024px)
- Full-featured UI
- All canvas actions available
- Optimized for mouse/trackpad

### 4. **Touch Target Optimization** (`excalidraw-mobile.css`)
```css
.excalidraw .ToolIcon_type_button,
.excalidraw button {
  min-width: 44px;
  min-height: 44px;
}

@media (max-width: 768px) {
  min-width: 48px;
  min-height: 48px;
}
```
- Meets Apple and Google minimum touch area guidelines (44px)
- Larger targets on mobile (48px) for easier interaction
- Prevents accidental taps

### 5. **Safe Area Insets** (iOS Notch Support)
```css
.excalidraw {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
```
- Respects device notches and home indicators
- Ensures UI elements aren't obscured
- Works on iPhone X and newer, modern Android devices

### 6. **Responsive Hook** (`useResponsive.ts`)
```tsx
const { isMobile, isTablet, isDesktop, width, height } = useResponsive();
```
- Real-time screen size detection
- Uses ResizeObserver for better performance
- Fallback to window resize events
- Provides breakpoint information for conditional rendering

### 7. **Touch Interaction Improvements**

#### Prevent Double-Tap Zoom
```css
.excalidraw button {
  touch-action: manipulation;
}
```

#### Active State Feedback
```css
.excalidraw button:active {
  transform: scale(0.95);
}
```
- Visual feedback on touch
- Smooth transitions for better UX

#### Prevent Text Selection During Drawing
```css
.excalidraw {
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
}
```

### 8. **Responsive Share Button**
```tsx
<button
  style={{
    minWidth: isMobile ? '48px' : '44px',
    minHeight: isMobile ? '48px' : '44px',
    touchAction: 'manipulation',
  }}
>
  <Globe />
  {!isMobile && 'Public'}
</button>
```
- Icon-only on mobile to save space
- Full text on tablet/desktop
- Proper touch targets
- Active state animation

### 9. **Modal & Dialog Optimization**
```css
@media (max-width: 768px) {
  .excalidraw .Modal {
    max-width: 95vw;
    max-height: 90vh;
  }
}
```
- Modals don't overflow on small screens
- Better context menu positioning

### 10. **Toolbar Optimization**
```css
@media (max-width: 768px) {
  .excalidraw .App-toolbar {
    gap: 4px;
  }
}
```
- Reduced spacing on mobile for better fit
- Maintains usability while maximizing canvas space

## File Structure

```
src/
├── components/
│   └── BoardEditor.tsx          # Main component with responsive logic
├── hooks/
│   └── useResponsive.ts         # Screen size detection hook
├── styles/
│   └── excalidraw-mobile.css    # Mobile-specific CSS optimizations
└── index.html                   # Viewport meta configuration
```

## Testing Checklist

### Mobile (< 768px)
- [ ] Touch targets are at least 48px
- [ ] Toolbar is accessible and doesn't overlap canvas
- [ ] Share button shows icon only
- [ ] No browser zoom on double-tap
- [ ] Safe areas respected on notched devices
- [ ] Simplified UI (no export, no background color change)

### Tablet (768px - 1024px)
- [ ] Touch targets are at least 44px
- [ ] Sidebar docks appropriately
- [ ] Share button shows icon + text
- [ ] Balanced UI features

### Desktop (> 1024px)
- [ ] Full UI features available
- [ ] Mouse interactions work smoothly
- [ ] Share button shows icon + text

### Cross-Device
- [ ] Smooth transitions between breakpoints
- [ ] No layout shifts during resize
- [ ] Consistent theme application
- [ ] Proper canvas zoom behavior

## Performance Considerations

1. **ResizeObserver**: Used for efficient resize detection
2. **useMemo**: UI options are memoized to prevent unnecessary re-renders
3. **useCallback**: Event handlers are memoized
4. **CSS Transitions**: Hardware-accelerated transforms for smooth animations

## Browser Support

- **iOS Safari**: 12+
- **Chrome Mobile**: Latest
- **Firefox Mobile**: Latest
- **Samsung Internet**: Latest
- **Desktop Browsers**: All modern browsers

## Future Enhancements

1. **Gesture Controls**: Custom gesture handling for advanced interactions
2. **Orientation Lock**: Option to lock orientation for drawing
3. **Haptic Feedback**: Vibration feedback on touch interactions (iOS/Android)
4. **Progressive Web App**: Add to home screen support
5. **Offline Mode**: Service worker for offline canvas editing

## Known Limitations

1. Image tool is disabled on mobile for simplicity
2. Some advanced export options hidden on mobile
3. Browser zoom is completely disabled (by design)

## Troubleshooting

### Issue: UI elements too small on mobile
**Solution**: Check that `excalidraw-mobile.css` is imported and touch target CSS is applied

### Issue: Browser zoom still works
**Solution**: Verify viewport meta tag in `index.html` has `user-scalable=no`

### Issue: Notch/safe area not respected
**Solution**: Ensure `env(safe-area-inset-*)` CSS is applied to `.excalidraw` container

### Issue: Layout breaks on orientation change
**Solution**: `useResponsive` hook should handle this automatically via ResizeObserver

## References

- [Apple Human Interface Guidelines - Touch Targets](https://developer.apple.com/design/human-interface-guidelines/inputs/touchscreen-gestures)
- [Material Design - Touch Targets](https://material.io/design/usability/accessibility.html#layout-and-typography)
- [Excalidraw Documentation](https://docs.excalidraw.com/)
- [Safe Area Insets](https://webkit.org/blog/7929/designing-websites-for-iphone-x/)
