import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import documentReducer from '../../store/documentSlice';
import { ActionButton } from '../ActionButton';
import { StatusBar } from '../StatusBar';
import { ErrorBar } from '../ErrorBar';
import { StepIndicator } from '../StepIndicator';
import { ValidationAlert } from '../ValidationAlert';

function makeStore() {
  return configureStore({ reducer: { document: documentReducer } });
}

function wrapper({ children }: { children: React.ReactNode }) {
  return <Provider store={makeStore()}>{children}</Provider>;
}

describe('ActionButton', () => {
  const onClick = vi.fn();

  it('renders step 1 label', () => {
    render(
      <ActionButton step={1} processing={false} generating={false} onClick={onClick} disabled={false} />,
      { wrapper },
    );
    expect(screen.getByText(/Обработать черновик/)).toBeInTheDocument();
  });

  it('shows loading when processing step 1', () => {
    render(
      <ActionButton step={1} processing={true} generating={false} onClick={onClick} disabled={true} />,
      { wrapper },
    );
    expect(screen.getByText(/Обработка…/)).toBeInTheDocument();
  });

  it('renders step 2 label', () => {
    render(
      <ActionButton step={2} processing={false} generating={false} onClick={onClick} disabled={false} />,
      { wrapper },
    );
    expect(screen.getByText(/Сформировать и скачать DOCX/)).toBeInTheDocument();
  });

  it('shows loading when generating step 2', () => {
    render(
      <ActionButton step={2} processing={false} generating={true} onClick={onClick} disabled={true} />,
      { wrapper },
    );
    expect(screen.getByText(/Формирование…/)).toBeInTheDocument();
  });

  it('button is disabled when disabled prop is true', () => {
    render(
      <ActionButton step={1} processing={false} generating={false} onClick={onClick} disabled={true} />,
      { wrapper },
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });
});

describe('StatusBar', () => {
  it('renders status text when visible', () => {
    render(<StatusBar status="Processing..." isVisible={true} />, { wrapper });
    expect(screen.getByText('Processing...')).toBeInTheDocument();
  });

  it('renders nothing when isVisible is false', () => {
    const { container } = render(<StatusBar status="Processing..." isVisible={false} />, { wrapper });
    expect(container.innerHTML).toBe('');
  });

  it('renders nothing when status is empty', () => {
    const { container } = render(<StatusBar status="" isVisible={true} />, { wrapper });
    expect(container.innerHTML).toBe('');
  });
});

describe('ErrorBar', () => {
  it('renders error text when visible', () => {
    render(<ErrorBar error="Something failed" isVisible={true} />, { wrapper });
    expect(screen.getByText('Something failed')).toBeInTheDocument();
  });

  it('renders nothing when isVisible is false', () => {
    const { container } = render(<ErrorBar error="err" isVisible={false} />, { wrapper });
    expect(container.innerHTML).toBe('');
  });
});

describe('StepIndicator', () => {
  it('renders both step labels', () => {
    render(<StepIndicator currentStep={1} />, { wrapper });
    expect(screen.getByText('Черновик')).toBeInTheDocument();
    expect(screen.getByText('Результат')).toBeInTheDocument();
  });
});

describe('ValidationAlert', () => {
  it('renders nothing when no missing fields and no warnings', () => {
    const { container } = render(
      <ValidationAlert missingFields={[]} warnings={[]} />,
      { wrapper },
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders missing field label', () => {
    render(
      <ValidationAlert
        missingFields={[{ field: 'to', label: 'Адресат' }]}
        warnings={[]}
      />,
      { wrapper },
    );
    expect(screen.getByText(/Адресат/)).toBeInTheDocument();
  });

  it('renders warnings', () => {
    render(
      <ValidationAlert missingFields={[]} warnings={['Check this']} />,
      { wrapper },
    );
    expect(screen.getByText('Check this')).toBeInTheDocument();
  });
});
