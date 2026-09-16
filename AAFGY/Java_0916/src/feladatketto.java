import java.util.Scanner;
public class feladatketto {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        System.out.print("Add meg a felhasználónevedet: ");
        String felhasznalonev = sc. next();
        System.out.println(felhasznalonev + ", a felhasználóneved, tetszik :)");
    }
}