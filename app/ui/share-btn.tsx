'use client';

import { useEffect, useState } from 'react';
import clsx from 'clsx';
import { ShareIcon } from '@heroicons/react/16/solid';
import styles from '@/app/ui/share-btn.module.css';

export default function ShareBtn({
  shareText,
  className,
}: {
  shareText: string;
  className?: string;
}) {
  const [messages, setMessages] = useState<string[]>([]);

  const copyToClipboard = async () => {
    if (window.navigator.clipboard) {
      try {
        await window.navigator.clipboard.writeText(shareText);

        setMessages([
          'Text copied to your clipboard.',
          'Share now with your friends :-)',
        ]);

        return;
      } catch (error) {}
    }

    const textarea = document.createElement('textarea');
    textarea.style.position = 'fixed';
    textarea.style.width = '1px';
    textarea.style.height = '1px';
    textarea.style.padding = '0';
    textarea.style.border = 'none';
    textarea.style.outline = 'none';
    textarea.style.boxShadow = 'none';
    textarea.style.background = 'transparent';
    document.body.appendChild(textarea);
    textarea.textContent = shareText;
    textarea.focus();
    textarea.select();
    const result = document.execCommand('copy');
    textarea.remove();
    if (!result) {
      setMessages(['Failed to copy the share text.']);
    } else {
      setMessages([
        'Text copied to your clipboard.',
        'Share now with your friends :-)',
      ]);
    }
  };

  useEffect(() => {
    if (messages.length) {
      const timer = setTimeout(() => {
        setMessages([]);
      }, 5000);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [messages]);

  const share = async () => {
    if (window.navigator.share) {
      try {
        await window.navigator.share({
          text: shareText,
        });
      } catch (error) {}

      return;
    }

    await copyToClipboard();
  };

  return (
    <div className={clsx(styles.shareBtnContainer, className)}>
      {!!messages.length && (
        <div>
          {messages.map((text, index) => {
            return (
              <p className={styles.shareInfo} key={`message-${index}`}>
                {text}
              </p>
            );
          })}
        </div>
      )}

      <button type='button' className='app-btn' onClick={share}>
        Share now <ShareIcon width={'1rem'} height={'1rem'} />
      </button>
    </div>
  );
}
