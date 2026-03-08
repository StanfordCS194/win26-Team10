interface ResumeViewerProps {
  url: string
  onClose: () => void
}

export function createResumeViewer(url: string, onClose: () => void): HTMLDivElement {
  // Create popup
  const popup = document.createElement('div')
  popup.className = 'popup'
  
  const popupBackground = document.createElement('div')
  popupBackground.className = 'popup-background'
  popupBackground.onclick = function() {
    onClose()
    popup.remove()
  }
  popup.appendChild(popupBackground)
  
  const popupContainer = document.createElement('div')
  popupContainer.className = 'popup-container'
  popupContainer.style.position = 'fixed'
  popupContainer.style.top = '50%'
  popupContainer.style.left = '50%'
  popupContainer.style.transform = 'translate(-50%, -50%)'
  popupContainer.style.width = '90%'
  popupContainer.style.height = '90%'
  popupContainer.style.maxWidth = '1200px'
  popupContainer.style.backgroundColor = 'white'
  popupContainer.style.borderRadius = '12px'
  popupContainer.style.padding = '0'
  popupContainer.style.boxShadow = '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
  
  // Create close button
  const closeButton = document.createElement('button')
  closeButton.innerHTML = '×'
  closeButton.style.position = 'absolute'
  closeButton.style.top = '10px'
  closeButton.style.right = '10px'
  closeButton.style.width = '40px'
  closeButton.style.height = '40px'
  closeButton.style.borderRadius = '50%'
  closeButton.style.border = 'none'
  closeButton.style.backgroundColor = '#fff'
  closeButton.style.color = '#333'
  closeButton.style.fontSize = '28px'
  closeButton.style.cursor = 'pointer'
  closeButton.style.display = 'flex'
  closeButton.style.alignItems = 'center'
  closeButton.style.justifyContent = 'center'
  closeButton.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)'
  closeButton.style.zIndex = '1001'
  closeButton.style.lineHeight = '1'
  closeButton.style.padding = '0'
  closeButton.onmouseover = () => {
    closeButton.style.backgroundColor = '#f0f0f0'
  }
  closeButton.onmouseout = () => {
    closeButton.style.backgroundColor = '#fff'
  }
  closeButton.onclick = function() {
    onClose()
    popup.remove()
  }
  
  // Create iframe to display the PDF/document
  const iframe = document.createElement('iframe')
  iframe.src = url
  iframe.style.width = '100%'
  iframe.style.height = '100%'
  iframe.style.border = 'none'
  iframe.style.borderRadius = '12px'
  
  popupContainer.appendChild(closeButton)
  popupContainer.appendChild(iframe)
  popup.appendChild(popupContainer)
  popup.style.display = 'flex'
  
  return popup
}
