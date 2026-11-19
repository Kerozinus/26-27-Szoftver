package com.example.calculator;

import javafx.event.ActionEvent;
import javafx.fxml.FXML;
import javafx.scene.control.Button;
import javafx.scene.control.TextField;

public class CalculatorController {

    @FXML
    private TextField display;

    private Double storedValue = null;
    private String pendingOp = null;
    private boolean startNewNumber = true;

    @FXML
    private void initialize() {
        if (display != null) display.setText("0");
    }

    @FXML
    private void onDigit(ActionEvent e) {
        String t = ((Button) e.getSource()).getText(); // "0-9" vagy "."

        if (startNewNumber) {
            display.setText(t.equals(".") ? "0." : t);
            startNewNumber = false;
            return;
        }

        if (t.equals(".") && display.getText().contains(".")) return;

        if (display.getText().equals("0") && !t.equals(".")) {
            display.setText(t);
        } else {
            display.setText(display.getText() + t);
        }
    }

    @FXML
    private void onOp(ActionEvent e) {
        String op = ((Button) e.getSource()).getText(); // + - * /

        double current = parseDisplay();

        if (storedValue == null) {
            storedValue = current;
        } else if (pendingOp != null && !startNewNumber) {
            storedValue = apply(storedValue, current, pendingOp);
            display.setText(format(storedValue));
        }

        pendingOp = op;
        startNewNumber = true;
    }

    @FXML
    private void onEquals() {
        if (storedValue == null || pendingOp == null) return;

        double current = parseDisplay();
        double result = apply(storedValue, current, pendingOp);

        display.setText(format(result));

        storedValue = null;
        pendingOp = null;
        startNewNumber = true;
    }

    @FXML
    private void onClear() {
        display.setText("0");
        storedValue = null;
        pendingOp = null;
        startNewNumber = true;
    }

    private double parseDisplay() {
        String s = display.getText();
        if (s == null || s.isBlank()) return 0.0;
        return Double.parseDouble(s);
    }

    private double apply(double a, double b, String op) {
        return switch (op) {
            case "+" -> a + b;
            case "-" -> a - b;
            case "*" -> a * b;
            case "/" -> (b == 0.0) ? 0.0 : a / b;
            default -> b;
        };
    }

    private String format(double v) {
        if (v == (long) v) return Long.toString((long) v);
        return Double.toString(v);
    }
}